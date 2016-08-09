frappe.pages['payment-details'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Payment Details',
		single_column: true
	});
	wrapper.payment_details = new payment_details(wrapper)
	frappe.breadcrumbs.add("Account");
}

payment_details = Class.extend({
	init: function(wrapper) {
		var me = this;
		this.wrapper_page = wrapper.page;
		this.page = $(wrapper).find('.layout-main-section-wrapper');
		this.wrapper = $(wrapper).find('.page-content');
		this.add_filter();
		this.render_payments_details();
	},

	add_filter: function() {
		var me = this;
		html = "<div>\
				<div class='col-xs-2 employee'></div>\
				<div class='col-xs-2 from_date'></div>\
  				<div class='col-xs-2 to_date'></div>\
  				<div class='col-xs-2 mode_of_payment'></div>\
  				<div class='col-xs-4></div>\
  				</div>\
  				<div>\
  				<div class='col-xs-1'></div>\
  				<div class='col-xs-10 table_data'></div>\
  				<div class='col-xs-1'></div>\
  				</div>\
				"
		me.page.html(html)
		me.employee = frappe.ui.form.make_control({
			parent: me.page.find(".employee"),
			df: {
			fieldtype: "Link",
			options: "Customer",
			fieldname: "customer",
			placeholder: "Select Customer"
			},
			render_input: true
		});
		me.employee.refresh();
		me.from_date = frappe.ui.form.make_control({
			parent: me.page.find(".from_date"),
			df: {
				fieldtype: "Date",
				fieldname: "from_date",
				placeholder: "From Date"
			},
			render_input: true
		});
		me.from_date.refresh();
		me.to_date = frappe.ui.form.make_control({
			parent: me.page.find(".to_date"),
			df: {
				fieldtype: "Date",
				fieldname: "to_date",
				placeholder: "To Date"
			},
			render_input: true
		});
		me.to_date.refresh();
		me.mode_of_payment = frappe.ui.form.make_control({
			parent: me.page.find(".mode_of_payment"),
			df: {
				fieldtype: "Link",
				fieldname: "mode_of_payment",
				options: "Mode of Payment",
				placeholder: "Select Mode of Payment"
			},
			render_input: true
		});
		me.mode_of_payment.refresh();
	},

	render_payments_details: function() {
		var me = this;
		me.page.find(".table_data").append(frappe.render_template("payment_details"))
	}
})