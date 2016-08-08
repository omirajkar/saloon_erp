// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

// frappe.require("assets/erpnext/js/controllers/taxes_and_totals.js");
frappe.provide("erpnext.pos");

erpnext.pos.PointOfSale = Class.extend({
	init: function(wrapper, frm) {
		
		this.wrapper = wrapper;
		this.frm = frm;
		this.wrapper.html(frappe.render_template("pos", {}));

		this.check_transaction_type();
		this.make();

		var me = this;
		$(this.frm.wrapper).on("refresh-fields", function() {
			me.refresh();
		});
		this.wrapper.find('input.discount-amount').on("change", function() {
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "discount_amount", flt(this.value));
		});
	},
	check_transaction_type: function() {
		var me = this;

		// Check whether the transaction is "Sales" or "Purchase"
		if (frappe.meta.has_field(cur_frm.doc.doctype, "customer")) {
			this.set_transaction_defaults("Customer");
		}
		else if (frappe.meta.has_field(cur_frm.doc.doctype, "supplier")) {
			this.set_transaction_defaults("Supplier");
		}
	},
	set_transaction_defaults: function(party) {
		var me = this;
		this.party = party;
		this.price_list = (party == "Customer" ?
			this.frm.doc.selling_price_list : this.frm.doc.buying_price_list);
		this.price_list_field = (party == "Customer" ? "selling_price_list" : "buying_price_list");
		this.sales_or_purchase = (party == "Customer" ? "Sales" : "Purchase");
	},
	make: function() {
		this.make_party();
		this.make_search();
		this.make_item_list();
	},
	make_party: function() {
		var me = this;
		this.party_field = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": this.party,
				"label": this.party,
				"fieldname": "pos_party",
				"placeholder": this.party
			},
			parent: this.wrapper.find(".party-area"),
			only_input: true,
		});
		this.party_field.make_input();
		this.party_field.$input.on("change", function() {
			if(!me.party_field.autocomplete_open)
				frappe.model.set_value(me.frm.doctype, me.frm.docname,
					me.party.toLowerCase(), this.value);
		});
	},
	make_search: function() {
		var me = this;
		this.search = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Data",
				"label": "Item",
				"fieldname": "pos_item",
				"placeholder": "Search Item"
			},
			parent: this.wrapper.find(".search-area"),
			only_input: true,
		});
		this.search.make_input();
		this.search.$input.on("keypress", function() {
			if(!me.search.autocomplete_open)
				if(me.item_timeout)
					clearTimeout(me.item_timeout);
				me.item_timeout = setTimeout(function() { me.make_item_list(); }, 1000);
		});
	},
	make_item_list: function() {
		var me = this;
		if(!this.price_list) {
			msgprint(__("Price List not found or disabled"));
			return;
		}

		me.item_timeout = null;
		frappe.call({
			method: 'erpnext.accounts.doctype.sales_invoice.pos.get_items',
			args: {
				sales_or_purchase: this.sales_or_purchase,
				price_list: this.price_list,
				item: this.search.$input.val()
			},
			callback: function(r) {
				var $wrap = me.wrapper.find(".item-list");
				me.wrapper.find(".item-list").empty();
				if (r.message) {
					if (r.message.length === 1) {
						var item = r.message[0];
						if (item.serial_no) {
							me.add_to_cart(item.item_code, item.serial_no);
							me.search.$input.val("");
							return;

						} else if (item.barcode) {
							me.add_to_cart(item.item_code);
							me.search.$input.val("");
							return;
						}
					}

					$.each(r.message, function(index, obj) {
						$(frappe.render_template("pos_item", {
							item_code: obj.name,
							item_price: format_currency(obj.price_list_rate, obj.currency),
							item_name: obj.name===obj.item_name ? "" : obj.item_name,
							item_image: obj.image ? "url('" + obj.image + "')" : null
						})).tooltip().appendTo($wrap);
					});
				}

				// if form is local then allow this function
				$(me.wrapper).find("div.pos-item").on("click", function() {
					if(me.frm.doc.docstatus==0) {
						me.add_to_cart($(this).attr("data-item-code"));
					}
				});
			}
		});
	},
	add_to_cart: function(item_code, serial_no) {
		var me = this;
		var caught = false;

		if(!me.frm.doc[me.party.toLowerCase()] && ((me.frm.doctype == "Quotation" &&
				me.frm.doc.quotation_to == "Customer")
				|| me.frm.doctype != "Quotation")) {
			msgprint(__("Please select {0} first.", [me.party]));
			return;
		}

		// get no_of_items
		var no_of_items = me.wrapper.find(".pos-bill-item").length;

		// check whether the item is already added
		if (no_of_items != 0) {
			$.each(this.frm.doc["items"] || [], function(i, d) {
				if (d.item_code == item_code) {
					caught = true;
					if (serial_no)
						frappe.model.set_value(d.doctype, d.name, "serial_no", d.serial_no + '\n' + serial_no);
					else
						frappe.model.set_value(d.doctype, d.name, "qty", d.qty + 1);
				}
			});
		}
		// if item not found then add new item
		if (!caught)
			this.add_new_item_to_grid(item_code, serial_no);

		this.refresh();
		this.refresh_search_box();
	},
	add_new_item_to_grid: function(item_code, serial_no) {
		var me = this;

		var child = frappe.model.add_child(me.frm.doc, this.frm.doctype + " Item", "items");
		child.item_code = item_code;
		child.qty = 1;

		if (serial_no)
			child.serial_no = serial_no;

		this.frm.script_manager.trigger("item_code", child.doctype, child.name);
		frappe.after_ajax(function() {
			me.frm.script_manager.trigger("qty", child.doctype, child.name);
		})
	},
	refresh_search_box: function() {
		var me = this;

		// Clear Item Box and remake item list
		if (this.search.$input.val()) {
			this.search.set_input("");
			this.make_item_list();
		}
	},
	update_qty: function(item_code, qty) {
		var me = this;
		$.each(this.frm.doc["items"] || [], function(i, d) {
			if (d.item_code == item_code) {
				if (qty == 0) {
					frappe.model.clear_doc(d.doctype, d.name);
					me.refresh_grid();
				} else {
					frappe.model.set_value(d.doctype, d.name, "qty", qty);
				}
			}
		});
		this.refresh();
	},
	refresh: function() {
		var me = this;

		this.refresh_item_list();
		this.refresh_fields();

		// if form is local then only run all these functions
		if (this.frm.doc.docstatus===0) {
			this.call_when_local();
		}

		this.disable_text_box_and_button();
		this.set_primary_action();

		// If quotation to is not Customer then remove party
		if (this.frm.doctype == "Quotation" && this.frm.doc.quotation_to!="Customer") {
			this.party_field.$input.prop("disabled", true);
		}
		
	},
	refresh_fields: function() {
		this.party_field.set_input(this.frm.doc[this.party.toLowerCase()]);
		this.wrapper.find('input.discount-amount').val(this.frm.doc.discount_amount);

		this.show_items_in_item_cart();
		this.show_taxes();
		this.set_totals();
	},
	refresh_item_list: function() {
		var me = this;
		// refresh item list on change of price list
		if (this.frm.doc[this.price_list_field] != this.price_list) {
			this.price_list = this.frm.doc[this.price_list_field];
			this.make_item_list();
		}
	},
	show_items_in_item_cart: function() {
		var me = this;
		var $items = this.wrapper.find(".items").empty();

		$.each(this.frm.doc.items|| [], function(i, d) {
			$(frappe.render_template("pos_bill_item", {
				item_code: d.item_code,
				item_name: (d.item_name===d.item_code || !d.item_name) ? "" : ("<br>" + d.item_name),
				qty: d.qty,
				actual_qty: d.actual_qty,
				projected_qty: d.projected_qty,
				rate: format_currency(d.rate, me.frm.doc.currency),
				amount: format_currency(d.amount, me.frm.doc.currency)
			})).appendTo($items);
		});

		this.wrapper.find("input.pos-item-qty").on("focus", function() {
			$(this).select();
		});
	},
	show_taxes: function() {
		var me = this;
		var taxes = this.frm.doc["taxes"] || [];
		$(this.wrapper)
			.find(".tax-area").toggleClass("hide", (taxes && taxes.length) ? false : true)
			.find(".tax-table").empty();

		$.each(taxes, function(i, d) {
			if (d.tax_amount) {
				$(frappe.render_template("pos_tax_row", {
					description: d.description,
					tax_amount: format_currency(flt(d.tax_amount)/flt(me.frm.doc.conversion_rate),
						me.frm.doc.currency)
				})).appendTo(me.wrapper.find(".tax-table"));
			}
		});
	},
	set_totals: function() {
		var me = this;
		this.wrapper.find(".net-total").text(format_currency(me.frm.doc["net_total"], me.frm.doc.currency));
		this.wrapper.find(".grand-total").text(format_currency(me.frm.doc.grand_total, me.frm.doc.currency));
	},
	call_when_local: function() {
		var me = this;

		// append quantity to the respective item after change from input box
		$(this.wrapper).find("input.pos-item-qty").on("change", function() {
			var item_code = $(this).parents(".pos-bill-item").attr("data-item-code");
			me.update_qty(item_code, $(this).val());
		});

		// increase/decrease qty on plus/minus button
		$(this.wrapper).find(".pos-qty-btn").on("click", function() {
			var $item = $(this).parents(".pos-bill-item:first");
			me.increase_decrease_qty($item, $(this).attr("data-action"));
		});

		this.focus();
	},
	focus: function() {
		if(this.frm.doc[this.party.toLowerCase()]) {
			this.search.$input.focus();
		} else {
			if(!(this.frm.doctype == "Quotation" && this.frm.doc.quotation_to!="Customer"))
				this.party_field.$input.focus();
		}
	},
	increase_decrease_qty: function($item, operation) {
		var item_code = $item.attr("data-item-code");
		var item_qty = cint($item.find("input.pos-item-qty").val());

		if (operation == "increase-qty")
			this.update_qty(item_code, item_qty + 1);
		else if (operation == "decrease-qty" && item_qty != 0)
			this.update_qty(item_code, item_qty - 1);
	},
	disable_text_box_and_button: function() {
		var me = this;
		// if form is submitted & cancelled then disable all input box & buttons
		$(this.wrapper)
			.find(".pos-qty-btn")
			.toggle(this.frm.doc.docstatus===0);

		$(this.wrapper).find('input, button').prop("disabled", !(this.frm.doc.docstatus===0));

		this.wrapper.find(".pos-item-area").																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																				Class("hide", me.frm.doc.docstatus!==0);

	},
	set_primary_action: function() {
		var me = this;
		if (this.frm.page.current_view_name==="main") return;

		if (this.frm.doctype == "Sales Invoice" && this.frm.doc.docstatus===0) {
			if (!this.frm.doc.is_pos) {
				this.frm.set_value("is_pos", 1);
			}
			this.frm.page.set_primary_action(__("Pay"), function() {
				me.make_payment();
			});
		} else if (this.frm.doc.docstatus===1) {
			this.frm.page.set_primary_action(__("New"), function() {
				erpnext.open_as_pos = true;
				new_doc(me.frm.doctype);
			});
		}
	},
	refresh_delete_btn: function() {
		$(this.wrapper).find(".remove-items").toggle($(".item-cart .warning").length ? true : false);
	},
	remove_selected_items: function() {
		var me = this;
		var selected_items = [];
		var no_of_items = $(this.wrapper).find("#cart tbody tr").length;
		for(var x=0; x<=no_of_items - 1; x++) {
			var row = $(this.wrapper).find("#cart tbody tr:eq(" + x + ")");
			if(row.attr("data-selected") == "true") {
				selected_items.push(row.attr("id"));
			}
		}

		var child = this.frm.doc["items"] || [];

		$.each(child, function(i, d) {
			for (var i in selected_items) {
				if (d.item_code == selected_items[i]) {
					frappe.model.clear_doc(d.doctype, d.name);
				}
			}
		});

		this.refresh_grid();
	},
	refresh_grid: function() {
		this.frm.dirty();
		this.frm.fields_dict["items"].grid.refresh();
		this.frm.script_manager.trigger("calculate_taxes_and_totals");
		this.refresh();
	},
	with_modes_of_payment: function(callback) {
		var me = this;
		if(me.modes_of_payment) {
			callback();
		} else {
			me.modes_of_payment = [];
			$.ajax("/api/resource/Mode of Payment").success(function(data) {
				$.each(data.data, function(i, d) { me.modes_of_payment.push(d.name); });
				callback();
			});
		}
	},
	make_payment: function() {
		var me = this;
		var no_of_items = this.frm.doc.items.length;

		if (no_of_items == 0)
			msgprint(__("Payment cannot be made for empty cart"));
		else {

			this.with_modes_of_payment(function() {
				// prefer cash payment!
				var default_mode = me.frm.doc.mode_of_payment ? me.frm.doc.mode_of_payment :
					me.modes_of_payment.indexOf(__("Cash"))!==-1 ? __("Cash") : undefined;

				// show payment wizard
				var dialog = new frappe.ui.Dialog({
					width: 400,
					title: 'Payment',
					fields: [
						{fieldtype:'Currency',
							fieldname:'total_amount', label: __('Total Amount'), read_only:1,
							"default": me.frm.doc.grand_total, read_only: 1},
						{fieldtype:'Select', fieldname:'mode_of_payment',
							label: __('Mode of Payment'),
							options: me.modes_of_payment.join('\n'), reqd: 1,
							"default": default_mode},
						{fieldtype:'Currency', fieldname:'paid_amount', label:__('Amount Paid'),
							reqd:1, "default": me.frm.doc.grand_total, hidden: 1, change: function() {
								var values = dialog.get_values();
								dialog.set_value("change", Math.round(values.paid_amount - values.total_amount));
								dialog.get_input("change").trigger("change");

							}},
						{fieldtype:'Currency', fieldname:'change', label: __('Change'),
							"default": 0.0, hidden: 1, change: function() {
								var values = dialog.get_values();
								var write_off_amount = (flt(values.paid_amount) - flt(values.change)) - values.total_amount;
								dialog.get_field("write_off_amount").toggle(write_off_amount);
								dialog.set_value("write_off_amount", write_off_amount);
							}
						},
						{fieldtype:'Currency', fieldname:'write_off_amount',
							label: __('Write Off'), "default": 0.0, hidden: 1},
					]
				});
				me.dialog = dialog;
				dialog.show();

				// make read only
				dialog.get_input("total_amount").prop("disabled", true);
				dialog.get_input("write_off_amount").prop("disabled", true);

				// toggle amount paid and change
				dialog.get_input("mode_of_payment").on("change", function() {
					var is_cash = dialog.get_value("mode_of_payment") === __("Cash");
					dialog.get_field("paid_amount").toggle(is_cash);
					dialog.get_field("change").toggle(is_cash);

					if (is_cash && !dialog.get_value("change")) {
						// set to nearest 5
						dialog.set_value("paid_amount", dialog.get_value("total_amount"));
						dialog.get_input("paid_amount").trigger("change");
					}
				}).trigger("change");

				//me.set_pay_button(dialog);
			});
		}
	},
	set_pay_button: function(dialog) {
		var me = this;
		dialog.set_primary_action(__("Pay"), function() {
			var values = dialog.get_values();
			var is_cash = values.mode_of_payment === __("Cash");
			if (!is_cash) {
				values.write_off_amount = values.change = 0.0;
				values.paid_amount = values.total_amount;
			}
			me.frm.set_value("mode_of_payment", values.mode_of_payment);

			var paid_amount = flt((flt(values.paid_amount) - flt(values.change)), precision("paid_amount"));
			me.frm.set_value("paid_amount", paid_amount);
			
			// specifying writeoff amount here itself, so as to avoid recursion issue
			me.frm.set_value("write_off_amount", me.frm.doc.grand_total - paid_amount);
			me.frm.set_value("outstanding_amount", 0);

			me.frm.savesubmit(this);
			dialog.hide();
		})

	}
});

erpnext.pos.make_pos_btn = function(frm) {
	frm.page.add_menu_item(__("{0} View", [frm.page.current_view_name === "pos" ? "Form" : "Point-of-Sale"]), function() {
		erpnext.pos.toggle(frm);
	});

	if(frm.pos_btn) return;

	// Show POS button only if it is enabled from features setup
	if (cint(sys_defaults.fs_pos_view)!==1 || frm.doctype==="Material Request") {
		return;
	}

	if(!frm.pos_btn) {
		frm.pos_btn = frm.page.add_action_icon("icon-th", function() {
			erpnext.pos.toggle(frm);
		});
	}

	if(erpnext.open_as_pos && frm.page.current_view_name !== "pos") {
		erpnext.pos.toggle(frm, true);
	}
}

erpnext.pos.toggle = function(frm, show) {
	// Check whether it is Selling or Buying cycle
	frappe.call({
		method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.set_price_list",
		// args: {
		// 	company: frm.doc.company
		// },
		callback: function(r) {
			if(r.message) {
				frm.doc.selling_price_list = r.message[0][0]
				refresh_field('selling_price_list')
			}

			var price_list = frappe.meta.has_field(cur_frm.doc.doctype, "selling_price_list") ?
				frm.doc.selling_price_list : frm.doc.buying_price_list;

			if(frm.page.current_view_name!=="pos") {
				if(!price_list) {
					frappe.throw(__("Please select Price List"));
				}
			}
			// if(!frm.pos) {
			// 	var wrapper = frm.page.add_view("pos", "<div>");
			// 	// frm.pos = new erpnext.pos.PointOfSale(wrapper, frm);
			// 	if (frm.doctype=='Sales Invoice'){	
			// 		frm.pos = new erpnext.pos.PointOfSaleSI(wrapper, frm);
			// 	}
			// 	else{
			// 		frm.pos = new erpnext.pos.PointOfSale(wrapper, frm);
			//     }
			// }

		}
	});

	// var price_list = frappe.meta.has_field(cur_frm.doc.doctype, "selling_price_list") ?
	// 	frm.doc.selling_price_list : frm.doc.buying_price_list;

	if(show!==undefined) {
		if((show===true && frm.page.current_view_name === "pos")
			|| (show===false && frm.page.current_view_name === "main")) {
			return;
		}
	}

	if (frm.page.current_view_name === "pos" && frm.doc.docstatus!=1) {
		frm.doc.currency_denomination='';
		refresh_field("currency_denomination")
	}

	// if(frm.page.current_view_name!=="pos") {
	// 	before switching, ask for pos name
	// 	if(!price_list) {
	// 		frappe.throw(__("Please select Price List"));
	// 	}

	// 	if(!frm.doc.company) {
	// 		frappe.throw(__("Please select Company"));
	// 	}
	// }

	// make pos
	if(!frm.pos) {
		var wrapper = frm.page.add_view("pos", "<div>");
		//frm.pos = new erpnext.pos.PointOfSale(wrapper, frm);
		if (frm.doctype=='Sales Invoice'){	
			frm.pos = new erpnext.pos.PointOfSaleSI(wrapper, frm);
		}
		else{
		frm.pos = new erpnext.pos.PointOfSale(wrapper, frm);
	   }
	}

	// toggle view
	frm.page.set_view(frm.page.current_view_name==="pos" ? "main" : "pos");

	frm.toolbar.current_status = null;
	frm.refresh();

	// refresh
	if(frm.page.current_view_name==="pos") {
		frm.pos.refresh();
	}

	frm.refresh();
}




///
erpnext.pos.PointOfSaleSI = Class.extend({
	init: function(wrapper, frm) {
		this.wrapper = wrapper;
		this.frm = frm;
		this.wrapper.html(frappe.render_template("pos_si", {}));
		this.mode_payment_sa(this.wrapper)
		this.currency_denomination_settting();
		//this.mode_cur_denom(this.wrapper)
		//this.mode_pay(this.wrapper,frm)
		this.check_transaction_type();
		this.make();
		this.add_advance_payment();

		var me = this;
		$(this.frm.wrapper).on("refresh-fields", function() {
			me.refresh();
			if (!cur_frm.doc.__unsaved){
				$("input[data-fieldname = mob_no]").val(this.frm.doc.mob_no);
			}

			$("input[data-fieldname = item_type]").val("Services");
		});

		this.wrapper.find('input.discount-amount').on("change", function() {
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "discount_amount", flt(this.value));
		});

		this.add_adon_value();
		this.add_tip_value();

	},
	add_advance_payment: function() {
		var me = this;
		this.frm.page.set_secondary_action(__("Advance Payment"), function() {
			var d = new frappe.ui.Dialog({
				title: __("Add New Advance Payment Entry"),
				fields: [
					{fieldtype:"Link", label:__("Customer"),
						options:'Customer', reqd:1, fieldname:"customer"},
					{fieldtype:"Float", label: __("Payment Amount"), 
						fieldname:"payment_amount",	reqd:1},
					{fieldtype:"Data", label:__("Reference No"), 
						fieldname:"reference_no"},
					{fieldtype:"Date", label:__("Reference Date"), 
						fieldname:"reference_date"},
					{fieldtype:"Button", label: __("Make Advance Payment Entry"), fieldname:"make_entry"},
				]
			});
			d.show();

			$(d.wrapper).find('button[data-fieldname = make_entry]').on("click", function (){
				var customer = $(d.wrapper).find('input[data-fieldname = customer]').val()
				var amount = $(d.wrapper).find('input[data-fieldname = payment_amount]').val()
				var ref_no = $(d.wrapper).find('input[data-fieldname = reference_no]').val()
				var ref_date = $(d.wrapper).find('input[data-fieldname = reference_date]').val()
				ref_date = frappe.datetime.user_to_str(ref_date)

				if (customer && amount){
					frappe.call({
						method: 'erpnext.accounts.doctype.sales_invoice.pos.make_payment_entry',
						args:{
							customer : customer,
							amount : amount,
							ref_no : ref_no,
							ref_date : ref_date
						},
						callback: function(r) {
							msgprint("Advance Payment Entry created Successfully...")
						}
					});
				}
				else{
					frappe.throw(__("Please enter all mandatory value first..."));
				}
				d.hide();
			})

			$(d.wrapper).find('input[data-fieldname = reference_date]').on("change", function (){
				var ref_date = $(d.wrapper).find('input[data-fieldname = reference_date]').val()
				var today = frappe.datetime.get_today()
				ref_date = frappe.datetime.user_to_str(ref_date)
				// if (ref_date && ref_date <= today){
				// 	msgprint("Reference Date should be greater than Current Date..")
				// 	$(d.wrapper).find('input[data-fieldname = reference_date]').val("");
				// }
			})
		});
	},

	check_transaction_type: function() {
		var me = this;

		// Check whether the transaction is "Sales" or "Purchase"
		if (frappe.meta.has_field(cur_frm.doc.doctype, "customer")) {
			this.set_transaction_defaults("Customer");
		}
		else if (frappe.meta.has_field(cur_frm.doc.doctype, "supplier")) {
			this.set_transaction_defaults("Supplier");
		}
	},

	currency_denomination_settting: function () {
		var me = this;
		
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Overtime Setting",
				fieldname: "currency_denomination",
				filters: {	name: me.frm.doc.company },
			},
			callback: function(r) {
				this.currency_denomination = r.message['currency_denomination']
				me.mode_cur_denom(this.currency_denomination);
				me.mode_pay(this.currency_denomination);
			}
		})
	},

	mode_cur_denom: function(currency_denom){
		var me = this;
		if(currency_denom){
			frappe.call({
				method: 'erpnext.accounts.doctype.sales_invoice.pos.get_currency_domination',
				args: {
						currency: me.frm.doc.currency
					},
				callback: function(r) {
					if (r.message) {
						html = ''

						html += "<div class='currency_dialog'>\
									<div class='col-xs-12'>\
											<div class='col-xs-3'>Label</div>\
											<div class='col-xs-3'>Received</div>\
											<div class='col-xs-3'>Returned</div>\
											<div class='col-xs-3'>Amount</div>\
										</div>\
										<hr>\
										<div class='tbody'></div>\
									</div>"
						/*$(html_1).appendTo($(me.wrapper).find('.demo'))*/
						for(var curr=0;curr<r.message.length;curr++) {
							html += "<div class='row pos-bill-row bill-cash'>\
								<div class='col-xs-3 lbl'>"+r.message[curr].label+"</div>\
									<div class='col-xs-3 rec'><input class='form-control received' type='number' value=0 min=0></div> \
									<div class='col-xs-3 ret'><input class='form-control return' type='number' value =0 min=0 ></div>\
									<div class='col-xs-3 amt'>0</div>\
									<div class='hidden val'>"+r.message[curr].value+"</div>\
								</div>"  
						}
						$(html).appendTo($(me.wrapper).find('.denom'))

						$(me.wrapper).find('input[type="number"]').change(function () {
							if(!(/^\+?\d+$/.test($(this).val()))){
								$(this).val(0)
								frappe.msgprint("Input must be integer value")
							}
						})
						$(me.wrapper).find(".received").change(function(){
							me.calculate_amount(this);
						})
						$(me.wrapper).find(".return").change(function(){
							me.calculate_amount(this);
						})
					}
				}
			});
		}
	},

	pay:function(wrapper){
		var me = this;	
		frappe.call({
			method: 'erpnext.accounts.doctype.journal_entry.journal_entry.get_payment_entry_from_sales_invoice_custom',
			args: {
				"sales_invoice": me.frm.doc
			}
		})
	},
	mode_pay:function(currency_denom){
		var me=this;
		$(me.wrapper).find('#paid').on("click", function() {
			var mode_total = 0
			var cash_total = 0
			var currency_cash = 0
			var val_1 = $(me.wrapper).find('.amount_one').val()
			var val_2 = $(me.wrapper).find('.amount_two').val()
			if(val_1 > 0){
				mode_total += parseFloat(val_1)
			}
			if(val_2 > 0){mode_total += parseFloat(val_2)}

			var cash = 0
			var mode_1 = $(me.wrapper).find('#mySelect').val()
			var mode_2 = $(me.wrapper).find('#mySelect2').val()
			var cash_flag = false

			if(mode_1 == "Select Mode" && val_1 > 0 || mode_2 == "Select Mode" && val_2 > 0){
				frappe.throw("Please select Mode of Payment")
			}
			if(mode_1 == "Cash") {
				var parent = $(me.wrapper).find('#mySelect').parent().parent()
				cash_total += ($(parent).find('.amount_one').val())
				cash_flag = true
			}
			if(mode_2 == "Cash"){
				var parent = $(me.wrapper).find('#mySelect2').parent().parent()
				cash_total += ($(parent).find('.amount_two').val())
				cash_flag = true
			}
			var bill_data = ($(me.wrapper).find('.bill-cash'))
			for(i=0;i<bill_data.length;i++){
				currency_cash += (($(bill_data[i]).find('.amt').text()) ? parseInt($(bill_data[i]).find('.amt').text()) : 0)
			}
			if (me.frm.doc.grand_total == mode_total) {
				if(cash_flag == false || currency_cash == cash_total || cash_flag == true && cash_total == 0 || !currency_denom) {
					me.frm.doc.mode_of_pay = []
					me.frm.doc.cash_details = []

					$(me.wrapper).find(".paid-amount").val(cash_total)

					if(mode_1 != "Select Mode"){
						var p = me.frm.add_child("mode_of_pay");
						p.mode_of_payment = mode_1
						p.amount = $(me.wrapper).find('.amount_one').val()
					}
					if(mode_2 != "Select Mode"){
						var pay = me.frm.add_child("mode_of_pay");
						pay.mode_of_payment = mode_2
						pay.amount = $(me.wrapper).find('.amount_two').val()
					}
					if(currency_cash > 0) {
						for(i=0;i<bill_data.length;i++){
							cash_data = ($(bill_data[i]).find('.lbl').text())
							me.frm.call({
									method: "frappe.client.get_value",
									async:false,
									args: {
										doctype: "Currency Denomination",
										fieldname: "value",
										filters: { parent: me.frm.doc.currency, label: cash_data},
									},
									callback: function(r) {
										cash = r.message['value']
									}
								})
							received = $(bill_data[i]).find('.received').val()
							returned = $(bill_data[i]).find('.return').val()
							if((received > 0 || returned > 0) && currency_denom ) {
								var cash_details = me.frm.add_child("cash_details");
								cash_details.currency_denomination = cash_data
								cash_details.received = received
								cash_details.received_amount = (cash*received)
								cash_details.returned = returned
								cash_details.returned_amount = (cash*returned)
							}
						}
					}
					me.frm.savesubmit(this, function(){ me.pay(wrapper);})
				}
				else{
					frappe.throw("Please Check Cash Details Provided for Cash Payment")
				}
			}
			else {
				frappe.throw("Grand Total ("+me.frm.doc.grand_total+") and Mode of Payment Total Received ("+mode_total+") Must be Equal")
			}
			})
	},
	mode_payment_sa: function(wrapper){
	var me = this;
	frappe.call({
		method: 'erpnext.crm.doctype.appointment.appointment.get_payment_mode',
		callback: function(r) {
			first_mode_select = "<div class='row pos-bill-row mode'>\
							<div class='col-xs-6'><select class = 'input-with-feedback form-control mode_pay' id='mySelect'>\
							<option>Select Mode</option><option selected='selected'>Cash</option></select></div>\
							<div class='col-xs-6'><input type='text' value='0.00' class='form-control amount_one'></div></div>\
							"
			sec_mode_select = "<div class='row pos-bill-row mode'>\
							<div class='col-xs-6'><select class = 'input-with-feedback form-control mode_pay' id='mySelect2'>\
							<option>Select Mode</option><option>Cash</option></select></div>\
							<div class='col-xs-6'><input type='text' value='0.00' class='form-control amount_two'></div></div>\
							"
			$(first_mode_select).appendTo($(me.wrapper).find('.demo'))
			$(sec_mode_select).appendTo($(me.wrapper).find('.demo'))
			
			var mySelect = ($(me.wrapper).find('#mySelect'));
			var mySelect2 = ($(me.wrapper).find('#mySelect2'));
			mode_list = [mySelect,mySelect2]
			for(var i=0;i<mode_list.length;i++) {
				$.each(r.message, function(index, value) {
					var option =r.message[index].mode_of_payment;
					if(option != "Cash")
				    {mode_list[i].append($('<option></option>').val(option).html(option))}
				});
			}
			me.amount_one()
			me.amount_two()
			me.mode_change()

			}
		});
		
	},
	
	amount_one: function() {
		var me = this;
		var mode_1 = $(me.wrapper).find('#mySelect').val()
		var mode_2 = $(me.wrapper).find('#mySelect2').val()
		$(me.wrapper).find('.amount_one').on("change", function() {
			amt_two = me.frm.doc.grand_total - $(me.wrapper).find('.amount_one').val()
			/*if(amt_two > 0 && mode_2 == "Select Mode") {
				$(me.wrapper).find(".amount_two").val(amt_two)
				console.log("mode_2",mode_2)
				frappe.msgprint("Select One More Mode of Payment")
			}*/
			if(amt_two >= 0 /*&& mode_2 != "Select Mode"*/){$(me.wrapper).find(".amount_two").val(amt_two)}
		})
	},
	amount_two:function() {
		var me = this;
		var mode_1 = $(me.wrapper).find('#mySelect').val()
		var mode_2 = $(me.wrapper).find('#mySelect2').val()
		$(me.wrapper).find('.amount_two').on("change", function() {
			amt_one = me.frm.doc.grand_total - $(me.wrapper).find('.amount_two').val()
			$(me.wrapper).find(".amount_one").val(amt_one)
			/*if(amt_one > 0 && mode_1 == "Select Mode") {
				console.log("mode_1",mode_1)
				$(me.wrapper).find(".amount_one").val(amt_one)
				frappe.msgprint("Select One More Mode of Payment")
			}*/
			if(amt_one >= 0 /*&& mode_1 != "Select Mode"*/){$(me.wrapper).find(".amount_one").val(amt_one)}
		})
	},
	
	mode_change:function() {
		var me = this;
		$(me.wrapper).find('.mode_pay').on("change", function() {
			var mode_1 = $(me.wrapper).find('#mySelect').val()
			var mode_2 = $(me.wrapper).find('#mySelect2').val()
			if(mode_1 == mode_2){frappe.msgprint("Please select another mode of Payment")}
			if(mode_1 == "Cash" || mode_2 == "Cash") {
				$(me.wrapper).find('.denom').show()
			}
			else{$(me.wrapper).find('.denom').hide()}
		})
	},

	set_transaction_defaults: function(party) {
		var me = this;
		this.party = party;
		this.price_list = (party == "Customer" ?
			this.frm.doc.selling_price_list : this.frm.doc.buying_price_list);
		this.price_list_field = (party == "Customer" ? "selling_price_list" : "buying_price_list");
		this.sales_or_purchase = (party == "Customer" ? "Sales" : "Purchase");
	},
	make: function() {
		this.make_mobile_no();
		this.search_service_products();
		// this.make_party();
		this.make_search();
		this.make_item_list();
	},
	make_mobile_no: function() {
		var me = this;
		
		this.mob_no = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": 'Contact',
				"label": 'Contact',
				"fieldname": "mob_no",
				"placeholder": "Mobile No"
			},
			parent: this.wrapper.find(".party-area1"),
			only_input: true,
		});
		this.mob_no.make_input();

		this.services = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Select",
				"options": ["Services","Products","All"],
				"label": 'Product/Services',
				"fieldname": "item_type",
				"placeholder": "Product Services"
			},
			parent: this.wrapper.find(".services1"),
			only_input: true,
		});
		this.services.make_input();
		this.services.$input.on("change", function() {
			$("input[data-fieldname = category]").val("");
			$("input[data-fieldname = sub_category]").val("");
			if(!me.services.autocomplete_open)
				if(me.item_timeout)
					clearTimeout(me.item_timeout);
				me.item_timeout = setTimeout(function() { me.search_service_products(); }, 1000);
		});
	
		this.category = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": 'Category',
				"label": 'Category',
				"fieldname": "category",
				"placeholder": "Category"
			},
			parent: this.wrapper.find(".services2"),
			only_input: true,
		});
		this.category.make_input();
		this.category.$input.on("change", function() {
			// $("input[data-fieldname = sub_category]").val("");
			if(!me.category.autocomplete_open)
				if(me.item_timeout)
					clearTimeout(me.item_timeout);
				me.item_timeout = setTimeout(function() { me.search_cat(); }, 1000);
		});

		this.sub_category = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": 'Sub Category',
				"label": 'Sub Category',
				"fieldname": "sub_category",
				"placeholder": "Sub Category"
			},
			parent: this.wrapper.find(".services3"),
			only_input: true,
		});
		this.sub_category.make_input();
		this.sub_category.$input.on("change", function() {
			$("input[data-fieldname = sub_category]").val("");
			if(!me.sub_category.autocomplete_open)
				if(me.item_timeout)
					clearTimeout(me.item_timeout);
				me.item_timeout = setTimeout(function() { me.search_subcat(); }, 1000);
		});

		this.party_field = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": this.party,
				"label": this.party,
				"fieldname": "pos_party",
				"placeholder": this.party
			},
			parent: this.wrapper.find(".party-area"),
			only_input: true,
		});
		this.party_field.make_input();
		
		this.mob_no.get_query = function() { 
			return{
					query: "erpnext.accounts.doctype.sales_invoice.pos.get_mobile_no"
				}
		}
		/*this.amt.$input.on("Change",function()
		{
			var am=me.amt.$input.val();
			frappe.call({
				method:''
			})
		})*/
		this.mob_no.$input.on("change", function() {
			var mob_no=me.mob_no.$input.val();
			frappe.call({
				method: 'erpnext.accounts.doctype.sales_invoice.pos.get_customer',
				args:{
					mob_no:mob_no
				},
				callback: function(r) {
					var cust = r.message[0][0]
					$("input[data-fieldname = pos_party]").val(cust);
					frappe.model.set_value(me.frm.doctype, me.frm.docname, me.party.toLowerCase(), cust);
				}
			});
			frappe.model.set_value(me.frm.doctype, me.frm.docname, this.value);
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "mob_no", mob_no);
		});

		$("input[data-fieldname = mob_no]").val(me.frm.doc.mob_no);
	},

	search_service_products: function() {
		var me = this;
		me.item_timeout = null;
		
		if (this.price_list){
			frappe.call({
				method: 'erpnext.accounts.doctype.sales_invoice.pos.service_products',
				args: {
					sales_or_purchase: this.sales_or_purchase,
					price_list: this.price_list,
					item: this.services.$input.val()
				},
				callback: function(r) {
					var $wrap = me.wrapper.find(".item-list");
					me.wrapper.find(".item-list").empty();
					if (r.message) {
						$.each(r.message, function(index, obj) {
							$(frappe.render_template("pos_item", {
								item_code: obj.name,
								item_price: format_currency(obj.price_list_rate, obj.currency),
								item_name: obj.name===obj.item_name ? "" : obj.item_name,
								item_image: obj.image ? "url('" + obj.image + "')" : null
							})).tooltip().appendTo($wrap);
						});
						$(me.wrapper).find("div.pos-item").on("click", function() {
							if(me.frm.doc.docstatus==0) {
								me.add_to_cart($(this).attr("data-item-code"));
							}
						});
					}
				}
			});		
		}
		else {
			frappe.throw(__("Please Create Price List First.."));
		}
		// this.refresh();
		// this.refresh_item_list();
	},

	search_cat: function() {
		var me = this;
		me.item_timeout = null;
		
		frappe.call({
			method: 'erpnext.accounts.doctype.sales_invoice.pos.search_categoty',
			args: {
				sales_or_purchase: this.sales_or_purchase,
				price_list: this.price_list,
				item: this.services.$input.val(),
				category: this.category.$input.val(),
				sub_category: this.sub_category.$input.val()
			},
			callback: function(r) {
				var $wrap = me.wrapper.find(".item-list");
				me.wrapper.find(".item-list").empty();
				if (r.message) {
					$.each(r.message, function(index, obj) {
						$(frappe.render_template("pos_item", {
							item_code: obj.name,
							item_price: format_currency(obj.price_list_rate, obj.currency),
							item_name: obj.name===obj.item_name ? "" : obj.item_name,
							item_image: obj.image ? "url('" + obj.image + "')" : null
						})).tooltip().appendTo($wrap);
					});
					$(me.wrapper).find("div.pos-item").on("click", function() {
						if(me.frm.doc.docstatus==0) {
							me.add_to_cart($(this).attr("data-item-code"));
						}
					});
				}
			}
		});		
	},

	search_subcat: function() {
		var me = this;
		me.item_timeout = null;
		
		frappe.call({
			method: 'erpnext.accounts.doctype.sales_invoice.pos.search_sub_categoty',
			args: {
				sales_or_purchase: this.sales_or_purchase,
				price_list: this.price_list,
				item: this.services.$input.val(),
				category: this.category.$input.val(),
				sub_category: this.sub_category.$input.val()
			},
			callback: function(r) {
				var $wrap = me.wrapper.find(".item-list");
				me.wrapper.find(".item-list").empty();
				if (r.message) {
					$.each(r.message, function(index, obj) {
						$(frappe.render_template("pos_item", {
							item_code: obj.name,
							item_price: format_currency(obj.price_list_rate, obj.currency),
							item_name: obj.name===obj.item_name ? "" : obj.item_name,
							item_image: obj.image ? "url('" + obj.image + "')" : null
						})).tooltip().appendTo($wrap);
					});
					$(me.wrapper).find("div.pos-item").on("click", function() {
						if(me.frm.doc.docstatus==0) {
							me.add_to_cart($(this).attr("data-item-code"));
						}
					});
				}
			}
		});		
	},

	make_party: function() {
		var me = this;
		this.party_field = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": this.party,
				"label": this.party,
				"fieldname": "pos_party",
				"placeholder": this.party
			},
			parent: this.wrapper.find(".party-area"),
			only_input: true,
		});
		this.party_field.make_input();
		this.party_field.$input.on("change", function() {
			if(!me.party_field.autocomplete_open)
				frappe.model.set_value(me.frm.doctype, me.frm.docname,
					me.party.toLowerCase(), this.value);
		});
	},
	make_search: function() {
		var me = this;
		this.search = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Data",
				"label": "Item",
				"fieldname": "pos_item",
				"placeholder": "Search Item"
			},
			parent: this.wrapper.find(".search-area"),
			only_input: true,
		});
		this.search.make_input();
		this.search.$input.on("keypress", function() {
			if(!me.search.autocomplete_open)
				if(me.item_timeout)
					clearTimeout(me.item_timeout);
				me.item_timeout = setTimeout(function() { me.make_item_list(); }, 1000);
		});
	},
	make_item_list: function() {
		var me = this;
		if(!this.price_list) {
			msgprint(__("Price List not found or disabled"));
			return;
		}

		me.item_timeout = null;
		frappe.call({
			method: 'erpnext.accounts.doctype.sales_invoice.pos.get_items',
			args: {
				sales_or_purchase: this.sales_or_purchase,
				price_list: this.price_list,
				item: this.search.$input.val()
			},
			callback: function(r) {
				var $wrap = me.wrapper.find(".item-list");
				me.wrapper.find(".item-list").empty();
				if (r.message) {
					if (r.message.length === 1) {
						var item = r.message[0];
						if (item.serial_no) {
							me.add_to_cart(item.item_code, item.serial_no);
							me.search.$input.val("");
							return;

						} else if (item.barcode) {
							me.add_to_cart(item.item_code);
							me.search.$input.val("");
							return;
						}
					}

					$.each(r.message, function(index, obj) {
						$(frappe.render_template("pos_item", {
							item_code: obj.name,
							item_price: format_currency(obj.price_list_rate, obj.currency),
							item_name: obj.name===obj.item_name ? "" : obj.item_name,
							item_image: obj.image ? "url('" + obj.image + "')" : null
						})).tooltip().appendTo($wrap);
					});
				}

				// if form is local then allow this function
				$(me.wrapper).find("div.pos-item").on("click", function() {
					if(me.frm.doc.docstatus==0) {
						me.add_to_cart($(this).attr("data-item-code"));
					}
				});
			}
		});
	},
	add_to_cart: function(item_code, serial_no) {
		var me = this;
		var caught = false;

		if(!me.frm.doc[me.party.toLowerCase()] && ((me.frm.doctype == "Quotation" &&
				me.frm.doc.quotation_to == "Customer")
				|| me.frm.doctype != "Quotation")) {
			msgprint(__("Please select {0} first.", [me.party]));
			return;
		}

		// get no_of_items
		var no_of_items = me.wrapper.find(".pos-bill-item").length;

		// check whether the item is already added
		if (no_of_items != 0) {
			$.each(this.frm.doc["items"] || [], function(i, d) {
				if (d.item_code == item_code && d.item_group != "Services") {
					caught = true;
					if (serial_no)
						frappe.model.set_value(d.doctype, d.name, "serial_no", d.serial_no + '\n' + serial_no);
					else
						frappe.model.set_value(d.doctype, d.name, "qty", d.qty + 1);
				}
			});
		}

		// if item not found then add new item
		if (!caught)
			this.add_new_item_to_grid(item_code, serial_no);

		this.refresh();
		this.refresh_search_box();
	},
	add_new_item_to_grid: function(item_code, serial_no) {
		var me = this;

		var child = frappe.model.add_child(me.frm.doc, this.frm.doctype + " Item", "items");	
		child.item_code = item_code;
		child.qty = 1;

		if (serial_no)
			child.serial_no = serial_no;

		this.frm.script_manager.trigger("item_code", child.doctype, child.name);
		
	},
	refresh_search_box: function() {
		var me = this;

		// Clear Item Box and remake item list
		if (this.search.$input.val()) {
			this.search.set_input("");
			this.make_item_list();
		}
		if (this.services.$input.val()) {
			this.search_service_products();
		}
	},
	update_qty: function(item_idx, qty) {
		var me = this;
		$.each(this.frm.doc["items"] || [], function(i, d) {
			if (d.idx == item_idx) {
				if (qty == 0 && (d.idx === cint(item_idx))) {
					frappe.model.clear_doc(d.doctype, d.name);
					me.refresh_grid();
					item_idx = 0
				} else {
					frappe.model.set_value(d.doctype, d.name, "qty", qty);
				}
			}
		});
		this.refresh();
	},
	refresh: function() {
		var me = this;

		// this.search_service_products();
		var amt1 = $(me.wrapper).find('.amount_one').val()
		var amt2 = $(me.wrapper).find('.amount_two').val()
		if(amt2 > 0){
			var value = parseFloat(me.frm.doc.grand_total) - parseFloat(amt2)
			$(me.wrapper).find('.amount_one').val(value)
		}
		else{
			$(me.wrapper).find('.amount_one').val(parseFloat(me.frm.doc.grand_total))
		}
		this.refresh_item_list();
		this.refresh_fields();
		this.add_advance_payment();
		if (this.frm.doc.docstatus===0) {
			this.call_when_local();
		}

		this.disable_text_box_and_button();
		this.set_primary_action();

		// If quotation to is not Customer then remove party
		if (this.frm.doctype == "Quotation" && this.frm.doc.quotation_to!="Customer") {
			this.party_field.$input.prop("disabled", true);
		}
	},
	refresh_fields: function() {
		this.party_field.set_input(this.frm.doc[this.party.toLowerCase()]);
		this.wrapper.find('input.discount-amount').val(this.frm.doc.discount_amount);
		this.wrapper.find('input.adon').val(this.frm.doc.adon);
		this.wrapper.find('input.adon-description').val(this.frm.doc.adon_description);
		this.wrapper.find('input.tip').val(this.frm.doc.tip);
		this.wrapper.find('input.party-area1').val(this.frm.doc.mob_no);

		this.show_items_in_item_cart();
		this.show_taxes();
		this.set_totals();
	},
	refresh_item_list: function() {
		var me = this;
		// refresh item list on change of price list
		if (this.frm.doc[this.price_list_field] != this.price_list) {
			this.price_list = this.frm.doc[this.price_list_field];
			this.make_item_list();
		}
		this.search_service_products();
	},
	show_items_in_item_cart: function() {
		var me = this;
		var $items = this.wrapper.find(".items").empty();

		$.each(this.frm.doc.items|| [], function(i, d) {
			$(frappe.render_template("pos_bill_item_si", {
				item_code: d.item_code,
				item_name: (d.item_name===d.item_code || !d.item_name) ? "" : ("<br>" + d.item_name),
				qty: d.qty,
				actual_qty: d.actual_qty,
				projected_qty: d.projected_qty,
				rate: format_currency(d.rate, me.frm.doc.currency),
				amount: format_currency(d.amount, me.frm.doc.currency),
				line_item_no: d.idx
			})).appendTo($items);
			me.get_employee(d.item_code, d.emp, d.idx)
		});
		
		this.wrapper.find("input.pos-item-qty").on("focus", function() {
			$(this).select();
		});

	},
	
	show_taxes: function() {
		var me = this;
		var taxes = this.frm.doc["taxes"] || [];
		$(this.wrapper)
			.find(".tax-area").toggleClass("hide", (taxes && taxes.length) ? false : true)
			.find(".tax-table").empty();

		$.each(taxes, function(i, d) {
			if (d.tax_amount) {
				$(frappe.render_template("pos_tax_row", {
					description: d.description,
					tax_amount: format_currency(flt(d.tax_amount)/flt(me.frm.doc.conversion_rate),
						me.frm.doc.currency)
				})).appendTo(me.wrapper.find(".tax-table"));
			}
		});
	},
	set_totals: function() {
		var me = this;
		this.wrapper.find(".net-total").text(format_currency(me.frm.doc["net_total"], me.frm.doc.currency));
		this.wrapper.find(".grand-total").text(format_currency(me.frm.doc.grand_total, me.frm.doc.currency));
	},
	call_when_local: function() {
		var me = this;
		// append quantity to the respective item after change from input box
		$(this.wrapper).find("input.pos-item-qty").on("change", function() {
			var item_code = $(this).parents(".pos-bill-item").attr("data-item-code");
			var item_idx = $(this).parents(".pos-bill-item").attr("data-item-code");
			me.update_qty(item_idx, $(this).val());
		});

		// increase/decrease qty on plus/minus button
		$(this.wrapper).find(".pos-qty-btn").on("click", function() {
			var $item = $(this).parents(".pos-bill-item:first");
			me.increase_decrease_qty($item, $(this).attr("data-action"));
		});

		this.focus();
	},
	add_adon_value: function(){
		var me = this;
		this.wrapper.find("input.adon").on("change", function() {
			// var adon = 0.0
			var adon = parseInt($(this).val());
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "adon", flt(adon));
			me.frm.script_manager.trigger("calculate_taxes_and_totals");
		});
		this.wrapper.find("input.adon-description").on("change", function() {
			var desc = $(this).val();
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "adon_description", desc);
		});

		$("input[data-fieldname = adon]").val(me.frm.doc.adon);
		$("input[data-fieldname = adon_description]").val(me.frm.doc.adon_description);
	},
	focus: function() {
		//alisha focus control added below and commented after below
        if(this.frm.doc[this.party.toLowerCase()]) {
                       this.search.$input.focus();
               } else {
                               if (cur_frm.doc.__unsaved){
                                       $("input[data-fieldname = mob_no]").val('');
                               }
                               this.mob_no.$input.focus();
               }

		/*if(this.frm.doc[this.party.toLowerCase()]) {
			this.mob_no.$input.focus();
		} else {
			if(!(this.frm.doctype == "Quotation" && this.frm.doc.quotation_to!="Customer"))
				if (cur_frm.doc.__unsaved){
					$("input[data-fieldname = mob_no]").val('');
				}
				this.mob_no.$input.focus();
		}*/
	},

	add_tip_value: function(){
		var me = this;
		this.wrapper.find("input.tip").on("change", function() {
			// var tip = 0.0
			var tip = parseInt($(this).val());
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "tip", flt(tip));
			//me.frm.script_manager.trigger("calculate_taxes_and_totals");
		});
		

		$("input[data-fieldname = tip]").val(me.frm.doc.tip);
		
	},
	
	get_employee: function(item_code, emp, idx) {
		var me = this;

		item = $.grep( $(".items").children(), function( n, i ) {
    		return $(n).attr("data-item-code") == item_code
			} );

		item = [item[item.length-1]]
		
		this.emp = frappe.ui.form.make_control({
			df: {
				"fieldtype": "Link",
				"options": 'Employee',
				"label": 'Employee',
				"fieldname": 'emp',
				"placeholder": 'Attended By'
			},
			parent: $(item).find(".pos-item-emp"),
			only_input: true,
		});

		this.emp.get_query = function() { 
			return{
					query: "erpnext.accounts.doctype.sales_invoice.pos.get_all_employee"
				}
		}
		this.emp.make_input();
		$(this.emp.$input).val(emp)

		this.emp.$input.on("change", function() {
			item_idx = $(this).parents().eq(3).attr("data-line-item")
			var e = this.value
			$.each(me.frm.doc.items|| [], function(i, d) {
				if (d.idx == item_idx){
					$("input[data-fieldname = emp]").val(e);
					frappe.model.set_value(d.doctype, d.name, "emp", e);
				}
			});
			me.frm.refresh_fields();
		});
	},
	increase_decrease_qty: function($item, operation) {
		var item_idx = $item.attr("data-line-item")
		var item_code = $item.attr("data-item-code");
		var item_qty = cint($item.find("input.pos-item-qty").val());

		if (operation == "increase-qty")
			this.update_qty(item_idx, item_qty + 1);
		else if (operation == "decrease-qty" && item_qty != 0)
			this.update_qty(item_idx, item_qty - 1);
	},
	disable_text_box_and_button: function() {
		var me = this;
		// if form is submitted & cancelled then disable all input box & buttons
		$(this.wrapper)
			.find(".pos-qty-btn")
			.toggle(this.frm.doc.docstatus===0);

		$(this.wrapper).find('input, button').prop("disabled", !(this.frm.doc.docstatus===0));

		this.wrapper.find(".pos-item-area").toggleClass("hide", me.frm.doc.docstatus!==0);

	},	
	set_primary_action: function() {
		var me = this;
		if (this.frm.page.current_view_name==="main") return;

		if (this.frm.doctype == "Sales Invoice" && this.frm.doc.docstatus===0) {
			if (!this.frm.doc.is_pos) {
				this.frm.set_value("is_pos", 1);
			}
			// commented to hide pay button
			//this.frm.page.set_primary_action(__("Pay"), function() {
			//	me.make_payment();
			//});
		} else if (this.frm.doc.docstatus===1) {
			this.frm.page.set_primary_action(__("New"), function() {
				erpnext.open_as_pos = true;
				new_doc(me.frm.doctype);
			});
		}
	},
	refresh_delete_btn: function() {
		$(this.wrapper).find(".remove-items").toggle($(".item-cart .warning").length ? true : false);
	},
	remove_selected_items: function() {
		var me = this;
		var selected_items = [];
		var no_of_items = $(this.wrapper).find("#cart tbody tr").length;
		for(var x=0; x<=no_of_items - 1; x++) {
			var row = $(this.wrapper).find("#cart tbody tr:eq(" + x + ")");
			if(row.attr("data-selected") == "true") {
				selected_items.push(row.attr("id"));
			}
		}

		var child = this.frm.doc["items"] || [];

		$.each(child, function(i, d) {
			for (var i in selected_items) {
				if (d.item_code == selected_items[i]) {
					frappe.model.clear_doc(d.doctype, d.name);
				}
			}
		});

		this.refresh_grid();
	},
	refresh_grid: function() {
		this.frm.dirty();
		this.frm.fields_dict["items"].grid.refresh();
		this.frm.script_manager.trigger("calculate_taxes_and_totals");
		this.refresh();
	},
	with_modes_of_payment: function(callback) {
		var me = this;
		if(me.modes_of_payment) {
			callback();
		} else {
			me.modes_of_payment = [];
			$.ajax("/api/resource/Mode of Payment").success(function(data) {
				$.each(data.data, function(i, d) { me.modes_of_payment.push(d.name); });
				callback();
			});
		}
	},
	make_payment: function() {
		var me = this;
		var no_of_items = this.frm.doc.items.length;

		if (no_of_items == 0)
			msgprint(__("Payment cannot be made for empty cart"));
		else {

			this.with_modes_of_payment(function() {
				// prefer cash payment!
				var default_mode = me.frm.doc.mode_of_payment ? me.frm.doc.mode_of_payment :
					me.modes_of_payment.indexOf(__("Cash"))!==-1 ? __("Cash") : undefined;

				// show payment wizard
				var dialog = new frappe.ui.Dialog({
					width: 400,
					title: 'Payment',
					fields: [
						{fieldtype:'Currency',
							fieldname:'total_amount', label: __('Total Amount'), read_only:1,
							"default": me.frm.doc.grand_total, read_only: 1},
						{fieldtype:'Select', fieldname:'mode_of_payment',
							label: __('Mode of Payment'),
							options: me.modes_of_payment.join('\n'), reqd: 1,
							"default": default_mode},

						{fieldtype:'HTML', fieldname:'rec_ret',
							label: __('Currency Denomination'),
						},

						{fieldtype:'Currency', fieldname:'paid_amount', label:__('Amount Paid'),
							reqd:1, "default": me.frm.doc.grand_total, hidden: 1, change: function() {
								var values = dialog.get_values();
								dialog.set_value("change", Math.round(values.paid_amount - values.total_amount));
								dialog.get_input("change").trigger("change");

							}},
						{fieldtype:'Currency', fieldname:'change', label: __('Change'),
							"default": 0.0, hidden: 1, change: function() {
								var values = dialog.get_values();
								var write_off_amount = (flt(values.paid_amount) - flt(values.change)) - values.total_amount;
								dialog.get_field("write_off_amount").toggle(write_off_amount);
								dialog.set_value("write_off_amount", write_off_amount);
							}
						},
						{fieldtype:'Currency', fieldname:'write_off_amount',
							label: __('Write Off'), "default": 0.0, hidden: 1},
					]
				});
				//remove the denomcurr

				// make read only
				dialog.get_input("total_amount").prop("disabled", true);
				dialog.get_input("write_off_amount").prop("disabled", true);

				// toggle amount paid and change
				dialog.get_input("mode_of_payment").on("change", function() {
					var is_cash = dialog.get_value("mode_of_payment") === __("Cash");
					dialog.get_field("paid_amount").toggle(is_cash);
					dialog.get_field("change").toggle(is_cash);
					//dialog.get_field("rec_ret").toggle(is_cash);
					if (is_cash){
						$("#currency_dialog").show();
					}
					else{
						$("#currency_dialog").hide();
					}

					if (is_cash && !dialog.get_value("change")) {
						// set to nearest 5
						dialog.set_value("paid_amount", dialog.get_value("total_amount"));
						dialog.get_input("paid_amount").trigger("change");
					}
				}).trigger("change");

				me.set_pay_button(dialog);
			});
		}
	},
	
	calculate_amount:function(cur_this){	
		rec_val=$(cur_this).parent().parent().find(".received").val() || 0;
		ret_val=$(cur_this).parent().parent().find(".return").val() || 0;
		value=$(cur_this).parent().parent().find(".val").text();
		ret_amount=parseFloat(ret_val)*parseFloat(value);
		rec_amount=parseFloat(rec_val)*parseFloat(value);
		$(cur_this).parent().parent().find(".amt").text((rec_amount - ret_amount).toFixed(3))
	},

/*	set_pay_button: function(dialog) {
		var me = this;
		dialog.set_primary_action(__("Pay"), function() {
			var values = dialog.get_values();
			var is_cash = values.mode_of_payment === __("Cash");
			if (!is_cash) {
				values.write_off_amount = values.change = 0.0;
				values.paid_amount = values.total_amount;
			}
			child_list=[];
			if (is_cash) {
				cur_row=$(dialog.wrapper).find("#currency_dialog .trow");
				$.each(cur_row,function(i,div_row){
					data_dict={};
					if($(div_row).find(".rec .received").val()!='0' || $(div_row).find(".ret .return").val()!='0')
					{
						data_dict["label"]=$(div_row).find(".lbl").text();
						// data_dict["image"]=$(div_row).find(".img").html();
						// data_dict["value"]=$(div_row).find(".cur_val").text();
						data_dict["received"]=$(div_row).find(".rec .received").val();
						data_dict["return"]=$(div_row).find(".ret .return").val();
						data_dict["amount"]=$(div_row).find(".amt").text();
						child_list.push(data_dict);
					}
				})
			}
			if(me.frm.doc.currency_denomination){
				me.frm.doc.currency_denomination='';
			}
			if(child_list){
				for(var item=0;item<child_list.length;item++)
				{
					var d = frappe.model.add_child(me.frm.doc, "Invoice Currency Denomination", "currency_denomination");
					d.label=child_list[item].label;
					// d.image=child_list[item].image;
					// d.value=child_list[item].value;
					d.received=child_list[item].received;
					d.return=child_list[item].return;
					d.amount=child_list[item].amount;
				}
				refresh_field("currency_denomination");
			}

			me.frm.set_value("mode_of_payment", values.mode_of_payment);

			var paid_amount = flt((flt(values.paid_amount) - flt(values.change)), precision("paid_amount"));
			me.frm.set_value("paid_amount", paid_amount);
			
			// specifying writeoff amount here itself, so as to avoid recursion issue
			me.frm.set_value("write_off_amount", me.frm.doc.grand_total - paid_amount);
			me.frm.set_value("outstanding_amount", 0);

			me.frm.savesubmit(this);
			dialog.hide();
		});

	},*/
set_pay_button: function(wrapper) {
		var me = this;
		wrapper.set_primary_action(__("Pay"), function() {
			var values = me.get_values();
			var is_cash = values.mode_of_payment === __("Cash");
			if (!is_cash) {
				values.write_off_amount = values.change = 0.0;
				values.paid_amount = values.total_amount;
			}
			child_list=[];
			if (is_cash) {
				cur_row=$(me.wrapper).find("#currency_dialog .trow");
				$.each(cur_row,function(i,div_row){
					data_dict={};
					if($(div_row).find(".rec .received").val()!='0' || $(div_row).find(".ret .return").val()!='0')
					{
						data_dict["label"]=$(div_row).find(".lbl").text();
						// data_dict["image"]=$(div_row).find(".img").html();
						// data_dict["value"]=$(div_row).find(".cur_val").text();
						data_dict["received"]=$(div_row).find(".rec .received").val();
						data_dict["return"]=$(div_row).find(".ret .return").val();
						data_dict["amount"]=$(div_row).find(".amt").text();
						child_list.push(data_dict);
					}
				})
			}
			if(me.frm.doc.currency_denomination){
				me.frm.doc.currency_denomination='';
			}
			if(child_list){
				for(var item=0;item<child_list.length;item++)
				{
					var d = frappe.model.add_child(me.frm.doc, "Invoice Currency Denomination", "currency_denomination");
					d.label=child_list[item].label;
					// d.image=child_list[item].image;
					// d.value=child_list[item].value;
					d.received=child_list[item].received;
					d.return=child_list[item].return;
					d.amount=child_list[item].amount;
				}
				refresh_field("currency_denomination");
			}

			me.frm.set_value("payments", values.mode_of_payment);

			var paid_amount = flt((flt(values.paid_amount) - flt(values.change)), precision("paid_amount"));
			me.frm.set_value("paid_amount", paid_amount);
			
			// specifying writeoff amount here itself, so as to avoid recursion issue
			me.frm.set_value("write_off_amount", me.frm.doc.grand_total - paid_amount);
			me.frm.set_value("outstanding_amount", 0);

			me.frm.savesubmit(this);
			me.hide();
		});

	},
/*add_tip_value: function(){
		var me = this;
		this.wrapper.find("input.tip").on("change", function() {
			// var tip = 0.0
			var tip = parseInt($(this).val());
			frappe.model.set_value(me.frm.doctype, me.frm.docname, "tip", flt(tip));
			//me.frm.script_manager.trigger("calculate_taxes_and_totals");
		});

		$("input[data-fieldname = tip]").val(me.frm.doc.tip);
			
	},*/
});
