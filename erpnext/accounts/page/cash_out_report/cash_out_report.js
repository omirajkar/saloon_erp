frappe.pages['cash-out-report'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Cash Out Report',
		single_column: true
	});

	wrapper.cash_out_report = new cash_out_report(wrapper)
	frappe.breadcrumbs.add("Accounts");
}

cash_out_report = Class.extend({
	init: function(wrapper) {
		var me = this;
		this.wrapper_page = wrapper.page;
		this.page = $(wrapper).find('.layout-main-section-wrapper');
		this.wrapper = $(wrapper).find('.page-content');
		this.make_page();
		this.render_cash_out_details();
		this.cash_out_button();
	},

	cash_out_button: function() {
		var me = this;
		me.wrapper_page.set_primary_action(__("Cash Out"), function() {
			frappe.call({
				method: "erpnext.accounts.page.cash_out_report.cash_out_report.cash_out_process",
				freeze: true,
				freeze_message: "Please Wait",
				callback: function(r) {
					me.render_cash_out_details();
				}
			})
		})
	},

	make_page: function() {
		var me = this;
		html = frappe.render_template("cash_out_report")
		me.page.html(html)

		me.date = frappe.ui.form.make_control({
			parent: me.page.find(".date"),
			df: {
				fieldtype: "Date",
				fieldname: "date",
				placeholder: "Date",
			},
			render_input: true
		});
		me.date.refresh();

		me.user = frappe.ui.form.make_control({
			parent: me.page.find(".user"),
			df: {
			fieldtype: "Link",
			options: "User",
			fieldname: "user",
			placeholder: "Select User"
			},
			render_input: true
		});
		me.user.refresh();

		me.date_filter();
		me.user_filter();
	},

	render_cash_out_details: function() {
		var me = this;
		var date = me.date.$input.val()
		var user = me.user.$input.val()

		frappe.call({
			method: "erpnext.accounts.page.cash_out_report.cash_out_report.get_cash_out_data",
			args: {"date": date, "user": user},
			callback: function(r) {
				me.page.find(".cash_out").empty()
				me.page.find(".cash_out").append(frappe.render_template("cash_out_data", {"data":r.message}))
			}
		})
	},

	date_filter: function() {
		var me = this;
		me.date.$input.on("change", function() {
			me.render_cash_out_details();
		})
	},

	user_filter: function() {
		var me = this;
		me.user.$input.on("change", function() {
			me.render_cash_out_details();
		})
	}
})