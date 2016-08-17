frappe.pages['daily-sales-report'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Daily Sales Report',
		single_column: true
	});

	wrapper.daily_sales_report = new daily_sales_report(wrapper)
	frappe.breadcrumbs.add("Accounts");
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
		this.set_print_button();
	},

	set_print_button: function() {
		var me = this;
		me.wrapper_page.set_primary_action(__("Export"), function() {
			var employee = me.employee.$input.val()
			var from_date = me.from_date.$input.val()
			var to_date = me.to_date.$input.val()
			var mode_of_pay = me.mode.$input.val()
			var is_sale = me.is_sale.last_value
			var is_service = me.is_service.last_value
			filters = [{'emp': employee, 'from_date': from_date, "to_date": to_date, "mode_of_pay": mode_of_pay, "is_sale": is_sale, "is_service": is_service}]
			window.location.href = repl(frappe.request.url +'?cmd=%(cmd)s&emp_data=%(emp_data)s&mode_of_pay=%(mode_of_pay)s&filters=%(filters)s', {
				cmd: "erpnext.accounts.page.daily_sales_report.daily_sales_report.create_csv",
				emp_data:JSON.stringify(me['emp_data']),
				mode_of_pay: JSON.stringify(me['mode_of_pay']),
				filters: JSON.stringify(filters)
			});
		})
	},

	make_page: function() {
		var me = this;
		html = frappe.render_template("daily_sales_report")
		me.page.html(html)
	},

	render_payments_details: function() {
		var me = this;
		me.single_emp_sales();
		me.get_mode_of_pay_details();
	},

	single_emp_sales: function() {
		var me = this;
		me.from_date = frappe.ui.form.make_control({
			parent: me.page.find(".from_date"),
			df: {
				fieldtype: "Date",
				fieldname: "from_date",
				placeholder: "Date",
			},
			render_input: true
		});
		me.from_date.refresh();

		me.to_date = frappe.ui.form.make_control({
			parent: me.page.find(".to_date"),
			df: {
				fieldtype: "Date",
				fieldname: "to_date",
				placeholder: "Date",
			},
			render_input: true
		});
		me.to_date.refresh();

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
		me.employee.refresh();

		me.mode = frappe.ui.form.make_control({
			parent: me.page.find(".mode"),
			df: {
			fieldtype: "Link",
			options: "Mode of Payment",
			fieldname: "employee",
			placeholder: "Mode"
			},
			render_input: true
		});
		me.mode.refresh()

		me.is_sale = frappe.ui.form.make_control({
			parent: me.page.find(".is_sale"),
			df: {
			fieldtype: "Check",
			fieldname: "is_sale",
			},
			// render_input: true
		});
		me.is_sale.value = true,
		me.is_sale.refresh()

		me.is_service = frappe.ui.form.make_control({
			parent: me.page.find(".is_service"),
			df: {
			fieldtype: "Check",
			fieldname: "is_service",
			placeholder: "Mode"
			},
			render_input: true
		});
		me.is_service.value = true,
		me.is_service.refresh()


		me.single_emp_sales_details();
		me.change_from_date();
		me.change_to_date()
		me.change_is_sale()
		me.change_is_service()
		me.change_employee();
	},

	single_emp_sales_details: function() {
		var me = this;
		var employee = me.employee.$input.val()
		var from_date = me.from_date.$input.val()
		var to_date = me.to_date.$input.val()
		var mode_of_pay = me.mode.$input.val()
		var is_sale = me.is_sale.last_value
		var is_service = me.is_service.last_value

		frappe.call({
			method: "erpnext.accounts.page.daily_sales_report.daily_sales_report.single_emp_sales_details",
			args: {"emp": employee, "from_date": from_date, 'to_date': to_date, 'mode_of_pay': mode_of_pay},
			callback: function(r) {
				me.page.find(".single_emp_data").empty();
				if(r.message[0][0]){
					me.emp_data = r.message
					mydata= r.message[0]
					blanklist= []
					if(is_sale==1 && is_service == 0){
						for(i=0;i<mydata.length;i++){
							if(flt(mydata[i]['tot_sales'])!=0){
								blanklist.push(mydata[i])
							}
						}
						me.page.find(".single_emp_data").append(frappe.render_template("single_emp_data", {"data":blanklist, "total": r.message[1], "case1":2}))
					}
					else if(is_sale==0 && is_service == 1){
						for(i=0;i<mydata.length;i++){
							if(flt(mydata[i]['tot_service'])!=0){
								blanklist.push(mydata[i])
							}
						}
						me.page.find(".single_emp_data").append(frappe.render_template("single_emp_data", {"data":blanklist, "total": r.message[1], "case1":3}))

					}
					else if(is_sale==1 && is_service == 1){
						me.page.find(".single_emp_data").append(frappe.render_template("single_emp_data", {"data":mydata, "total": r.message[1], "case1":1}))
					}
					else {
						me.page.find(".single_emp_data").append(frappe.render_template("single_emp_data", {"data":blanklist, "total": r.message[1], "case1":4}))
					}
				}
				else
					me.page.find(".single_emp_data").append("<div class='text-muted text-center' style='font-weight: bold; padding-top: 100px'>No Data Found</div>")
				me.get_mode_of_pay_details();
			}
		})
	},

	get_mode_of_pay_details: function() {
		var me = this;
		var from_date = me.from_date.$input.val()
		var to_date = me.to_date.$input.val()
		var mode_of_pay = me.mode.$input.val()
		var is_sale = me.is_sale.$input.val()
		var is_service = me.is_service.$input.val()


		frappe.call({
			method:"erpnext.accounts.page.daily_sales_report.daily_sales_report.get_mode_of_pay_details",
			args: {"from_date": from_date, 'to_date': to_date, 'mode_of_pay': mode_of_pay, "is_sale": is_sale, "is_service":is_service},
			callback: function(r) {
				me.mode_of_pay = r.message
				me.page.find(".mode_of_pay_data").empty();
				if(r.message[0][0])
					me.page.find(".mode_of_pay_data").append(frappe.render_template("mode_of_payment", {"data": r.message[0], "total": r.message[1]}));
				else
					me.page.find(".mode_of_pay_data").append("<div class='text-muted text-center' style='font-weight: bold; padding-top: 100px'>No Data Found</div>")
				me.mode_of_payment_change();
			}
		})
	},

	change_employee: function() {
		var me = this;
		me.employee.$input.on("change", function(){
			me.single_emp_sales_details();
		})
	},

	change_from_date: function() {
		var me = this;
		me.from_date.$input.on("change", function() {
			from_date = me.from_date.$input.val();
			to_date = me.to_date.$input.val();
			if((from_date && to_date) && from_date > to_date) {
				msgprint("From Date Must be smaller than To Date")
				return false
			}
			else {
				me.single_emp_sales_details();
				me.get_mode_of_pay_details();
			}
		})
	},

	change_to_date: function() {
		var me = this;
		me.to_date.$input.on("change", function() {
			from_date = me.from_date.$input.val();
			to_date = me.to_date.$input.val();

			if((from_date && to_date) && to_date < from_date) {
				msgprint("To Date Must be greater than From Date")
				return false
			}
			else {
				me.single_emp_sales_details();
				me.get_mode_of_pay_details();
			}
		})
	},
	change_is_sale: function() {
		var me = this;
		me.is_sale.$input.on("change", function() {
			from_date = me.from_date.$input.val();
			to_date = me.to_date.$input.val();

			if((from_date && to_date) && to_date < from_date) {
				msgprint("To Date Must be greater than From Date")
				return false
			}
			else {
				me.single_emp_sales_details();
				me.get_mode_of_pay_details();
			}
		})
	},
	change_is_service: function() {
		var me = this;
		me.is_service.$input.on("change", function() {
			from_date = me.from_date.$input.val();
			to_date = me.to_date.$input.val();

			if((from_date && to_date) && to_date < from_date) {
				msgprint("To Date Must be greater than From Date")
				return false
			}
			else {
				me.single_emp_sales_details();
				me.get_mode_of_pay_details();
			}
		})
	},

	mode_of_payment_change: function() {
		var me = this;
		me.mode.$input.on("change", function() {
			me.get_mode_of_pay_details();
		})
	},



})