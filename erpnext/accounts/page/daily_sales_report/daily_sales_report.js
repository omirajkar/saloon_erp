frappe.pages['daily-sales-report'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Daily Sales Report',
		single_column: true
	});

	wrapper.daily_sales_report = new daily_sales_report(wrapper)
	frappe.breadcrumbs.add("Account");
}

daily_sales_report = Class.extend({
	init: function(wrapper) {
		var me = this;
		this.wrapper_page = wrapper.page;
		this.page = $(wrapper).find('.layout-main-section-wrapper');
		//this.page = $(wrapper).find('.page-content');
		this.wrapper = $(wrapper).find('.page-content');
		this.make_page();
		this.render_payments_details();
	},

	make_page: function() {
		var me = this;
		html = frappe.render_template("daily_sales_report")
		me.page.html(html)
	},

	render_payments_details: function() {
		var me = this;
		me.single_emp_sales();
		me.mode_of_pay_details();
		me.all_employee_details();
	},

	single_emp_sales: function() {
		var me = this;
		me.employee = frappe.ui.form.make_control({
			parent: me.page.find(".employee"),
			df: {
			fieldtype: "Link",
			options: "Employee",
			fieldname: "employee",
			placeholder: "Select Employee"
			},
			render_input: true
		});
		me.employee.refresh()

		me.single_emp_date = frappe.ui.form.make_control({
			parent: me.page.find(".single_emp_date"),
			df: {
				fieldtype: "Date",
				fieldname: "single_emp_date",
				placeholder: "Date",
			},
			render_input: true
		});
		me.single_emp_date.refresh();
		me.single_emp_sales_details();
	},

	mode_of_pay_details: function() {
		var me = this;
		me.mode_of_pay_date = frappe.ui.form.make_control({
			parent: me.page.find(".mode_of_pay_date"),
			df: {
				fieldtype: "Date",
				fieldname: "mode_of_pay_date",
				placeholder: "Date",
			},
			render_input: true
		});
		me.mode_of_pay_date.refresh();
		me.mode_of_pay_date.$input.val( moment().format('DD-MM-YYYY'))
		me.get_mode_of_pay_details();
	},

	all_employee_details: function() {
		var me = this;
		me.all_emp_date = frappe.ui.form.make_control({
			parent: me.page.find(".employee_date"),
			df: {
				fieldtype: "Date",
				fieldname: "all_emp_date",
				placeholder: "Date",
			},
			render_input: true
		});
		me.all_emp_date.refresh();
		me.all_emp_date.$input.val( moment().format('DD-MM-YYYY'))
		me.get_all_emp_income_detail();
	},

	change_employee: function() {
		var me = this;
		me.employee.$input.on("change", function(){
			me.single_emp_sales_details();
		})
	},

	change_single_emp_date: function() {
		var me = this;
		me.single_emp_date.$input.on("change", function() {
			me.single_emp_sales_details();	
		})
	},

	single_emp_sales_details: function() {
		var me = this;
		var employee = me.employee.$input.val()
		var date = me.single_emp_date.$input.val()
		frappe.call({
			method: "erpnext.accounts.page.daily_sales_report.daily_sales_report.single_emp_sales_details",
			args: {"emp": employee, "date": date},
			callback: function(r) {
				me.page.find(".single_emp_data").empty();
				if(r.message)
					me.page.find(".single_emp_data").append(frappe.render_template("single_emp_data", {"data":r.message[0], "total": r.message[1]}))
				else
					me.page.find(".single_emp_data").append("<div class='text-muted text-center' style='font-weight: bold; padding-top: 100px'>No Data Found</div>")
				me.change_employee();
				me.change_single_emp_date();
			}
		})
	},


	change_mode_date: function() {
		var me = this;
		me.mode_of_pay_date.$input.on("change", function() {
			me.get_mode_of_pay_details();
		})
	},

	get_mode_of_pay_details: function() {
		var me = this;
		var date = me.mode_of_pay_date.$input.val()
		frappe.call({
			method:"erpnext.accounts.page.daily_sales_report.daily_sales_report.get_mode_of_pay_details",
			args: {"date": date},
			callback: function(r) {
				me.page.find(".mode_of_pay_data").empty();
				if(r.message[0][0])
					me.page.find(".mode_of_pay_data").append(frappe.render_template("mode_of_payment", {"data": r.message[0], "total": r.message[1]}));
				else
					me.page.find(".mode_of_pay_data").append("<div class='text-muted text-center' style='font-weight: bold; padding-top: 100px'>No Data Found</div>")
				me.change_mode_date();
			}
		})
	},

	get_all_emp_income_detail: function() {
		var me = this;
		var date = me.all_emp_date.$input.val()
		frappe.call({
			method: "erpnext.accounts.page.daily_sales_report.daily_sales_report.get_all_emp_income_detail",
			args: {"date": date},
			callback: function(r) {
				me.page.find(".all_emp_data").empty()
				if(r.message[0][0])
					me.page.find(".all_emp_data").append(frappe.render_template("all_emp_income_detail", {"data":r.message[0], "total": r.message[1]}))
				else
					me.page.find(".all_emp_data").append("<div class='text-muted text-center' style='font-weight: bold; padding-top: 100px'>No Data Found</div>")
				me.change_all_emp_date();	
			}
		})
	},

	change_all_emp_date: function() {
		var me = this;
		me.all_emp_date.$input.on("change", function() {	
			me.get_all_emp_income_detail();
		})
	}

})