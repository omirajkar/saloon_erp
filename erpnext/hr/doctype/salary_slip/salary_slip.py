# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe, json

from frappe.utils import add_days, cint, cstr, flt, getdate, nowdate, rounded
from frappe.model.naming import make_autoname

from frappe import msgprint, _
from erpnext.setup.utils import get_company_currency
from erpnext.hr.utils import set_employee_name

from erpnext.utilities.transaction_base import TransactionBase

class SalarySlip(TransactionBase):
	def autoname(self):
		self.name = make_autoname('Sal Slip/' +self.employee + '/.#####')

	def get_emp_and_leave_details(self):
		if self.employee:
			# self.get_leave_details()
			struct = self.check_sal_struct()
			if struct:
				self.pull_sal_struct(struct)

	def check_sal_struct(self):
		struct = frappe.db.sql("""select name from `tabSalary Structure`
			where employee=%s and is_active = 'Yes'""", self.employee)
		if not struct:
			msgprint(_("Please create Salary Structure for employee {0}").format(self.employee))
			self.employee = None
		return struct and struct[0][0] or ''

	def pull_sal_struct(self, struct):
		from erpnext.hr.doctype.salary_structure.salary_structure import make_salary_slip
		self.update(make_salary_slip(struct, self).as_dict())

	def pull_emp_details(self):
		emp = frappe.db.get_value("Employee", self.employee,
			["bank_name", "bank_ac_no"], as_dict=1)
		if emp:
			self.bank_name = emp.bank_name
			self.bank_account_no = emp.bank_ac_no

	def get_leave_details(self, lwp=None):
		# if self.get("__islocal") :
		unpaid_days = frappe.db.sql("""select count(*) from tabAttendance where status not in ("Weekly Off") and status 
			in (select name from `tabAttendance Status` where paid = 0) and MONTH(att_date) = '%s' and employee = '%s' """%(self.month, self.employee))

		if not self.fiscal_year:
			self.fiscal_year = frappe.db.get_default("fiscal_year")
		if not self.month:
			self.month = "%02d" % getdate(nowdate()).month

		m = frappe.get_doc('Process Payroll').get_month_details(self.fiscal_year, self.month)
		holidays = self.get_holidays_for_employee(m)

		if not cint(frappe.db.get_value("HR Settings", "HR Settings",
			"include_holidays_in_total_working_days")):
				m["month_days"] -= len(holidays)
				if m["month_days"] < 0:
					frappe.throw(_("There are more holidays than working days this month."))

		if not lwp:
			lwp = self.calculate_lwp(holidays, m)

		self.total_days_in_month = m['month_days']
		self.leave_without_pay = lwp + unpaid_days[0][0]
		payment_days = (flt(self.get_payment_days(m)) - flt(lwp)) - unpaid_days[0][0]
		self.payment_days = payment_days > 0 and payment_days or 0

	def get_payment_days(self, m):
		# frappe.errprint("in get_payment_days......")
		# frappe.errprint(m['month_days'])
		# unpaid_days = frappe.db.sql("""select count(*) from tabAttendance where status not in ("Weekly Off") and status 
		# 	in (select name from `tabAttendance Status` where paid = 0) and MONTH(att_date) = %s and employee = '%s' """%(self.month, self.employee))
		# frappe.errprint(unpaid_days[0][0])
		# payment_days = m['month_days'] - unpaid_days[0][0]
		# frappe.errprint(payment_days)
		payment_days = m['month_days']
		emp = frappe.db.sql("select date_of_joining, relieving_date from `tabEmployee` \
			where name = %s", self.employee, as_dict=1)[0]

		if emp['relieving_date']:
			if getdate(emp['relieving_date']) > m['month_start_date'] and \
				getdate(emp['relieving_date']) < m['month_end_date']:
					payment_days = getdate(emp['relieving_date']).day
			elif getdate(emp['relieving_date']) < m['month_start_date']:
				frappe.throw(_("Employee relieved on {0} must be set as 'Left'").format(emp["relieving_date"]))

		if emp['date_of_joining']:
			if getdate(emp['date_of_joining']) > m['month_start_date'] and \
				getdate(emp['date_of_joining']) < m['month_end_date']:
					payment_days = payment_days - getdate(emp['date_of_joining']).day + 1
			elif getdate(emp['date_of_joining']) > m['month_end_date']:
				payment_days = 0

		return payment_days

	def get_holidays_for_employee(self, m):
		holidays = frappe.db.sql("""select t1.holiday_date
			from `tabHoliday` t1, tabEmployee t2
			where t1.parent = t2.holiday_list and t2.name = %s
			and t1.holiday_date between %s and %s""",
			(self.employee, m['month_start_date'], m['month_end_date']))
		if not holidays:
			holidays = frappe.db.sql("""select t1.holiday_date
				from `tabHoliday` t1, `tabHoliday List` t2
				where t1.parent = t2.name and ifnull(t2.is_default, 0) = 1
				and t2.fiscal_year = %s
				and t1.holiday_date between %s and %s""", (self.fiscal_year,
					m['month_start_date'], m['month_end_date']))
		holidays = [cstr(i[0]) for i in holidays]
		return holidays

	def calculate_lwp(self, holidays, m):
		lwp = 0
		for d in range(m['month_days']):
			dt = add_days(cstr(m['month_start_date']), d)
			if dt not in holidays:
				leave = frappe.db.sql("""
					select t1.name, t1.half_day
					from `tabLeave Application` t1, `tabLeave Type` t2
					where t2.name = t1.leave_type
					and ifnull(t2.is_lwp, 0) = 1
					and t1.docstatus = 1
					and t1.employee = %s
					and %s between from_date and to_date
				""", (self.employee, dt))
				if leave:
					lwp = cint(leave[0][1]) and (lwp + 0.5) or (lwp + 1)
		return lwp

	def check_existing(self):
		ret_exist = frappe.db.sql("""select name from `tabSalary Slip`
			where month = %s and fiscal_year = %s and docstatus != 2
			and employee = %s and name != %s""",
			(self.month, self.fiscal_year, self.employee, self.name))
		if ret_exist:
			self.employee = ''
			frappe.throw(_("Salary Slip of employee {0} already created for this month").format(self.employee))

	def validate(self):
		from frappe.utils import money_in_words
		self.check_existing()

		if not (len(self.get("earnings")) or
			len(self.get("deductions"))):
				self.get_emp_and_leave_details()
		# else:
		# 	self.get_leave_details(self.leave_without_pay)

		if not self.net_pay:
			self.calculate_net_pay()

		company_currency = get_company_currency(self.company)
		self.total_in_words = money_in_words(self.rounded_total, company_currency)

		set_employee_name(self)

	def calculate_earning_total(self):
		self.gross_pay = flt(self.arrear_amount) + flt(self.leave_encashment_amount)
		for d in self.get("earnings"):
			if cint(d.e_depends_on_lwp) == 1:
				d.e_modified_amount = rounded((flt(d.e_amount) * flt(self.payment_days)
					/ cint(self.total_days_in_month)), self.precision("e_modified_amount", "earnings"))
			elif not self.payment_days:
				d.e_modified_amount = 0
			elif not d.e_modified_amount:
				d.e_modified_amount = d.e_amount
			self.gross_pay += flt(d.e_modified_amount)

	def calculate_ovetime_total(self):
		emp_hourly_ot_amount,emp_hourly_oth_amount,ot_hours,oth_hours,total_ot_amount=0.0 ,0.0,0.0,0.0,0.0

		std_ot_hours=frappe.db.get_value("Overtime Setting", self.company, "working_hours")
		if not std_ot_hours:
			std_ot_hours=frappe.db.get_value("Overtime Setting", 'vlinku', "working_hours")

		std_ot_days=self.total_days_in_month

		fri_ot_rate=frappe.db.get_value("Overtime Setting", self.company, "working_days")
		if not fri_ot_rate:
			fri_ot_rate=frappe.db.get_value("Overtime Setting", 'vlinku', "working_days")

		std_ot_rate=frappe.db.get_value("Overtime Setting", self.company, "normal_ot_rate_for_hour")
		if not std_ot_rate:
			std_ot_rate=frappe.db.get_value("Overtime Setting", 'vlinku', "normal_ot_rate_for_hour")				

		std_oth_rate=frappe.db.get_value("Overtime Setting", self.company, "holiday_ot_rate_for_hour")
		if not std_oth_rate:
			std_oth_rate=frappe.db.get_value("Overtime Setting", 'vlinku', "holiday_ot_rate_for_hour")

		if self.month<=3:
			year=self.fiscal_year.split('-')[1]
		else:
			year=self.fiscal_year.split('-')[0]
		res=frappe.db.sql("select ifnull(sum(ot_hours),0.0) as ot_hours,ifnull(sum(holiday_ot_hours),0.0) as oth_hours,ifnull(sum(fot),0.0) as fot_hours from tabAttendance where employee='%s' and company='%s' and Month(att_date)='%s' and Year(att_date)='%s' "%(self.employee,self.company,self.month,year),as_dict=1)
		# frappe.errprint(['std_ot_hours',std_ot_hours])
		# frappe.errprint(['res',res])
		if res:
			ot_hours=res and res[0]['ot_hours'] or 0.0
			oth_hours=res and res[0]['oth_hours'] or 0.0
			fot_hours=res and res[0]['fot_hours'] or 0.0
		for d in self.get("earnings"):
			if d.e_type == 'Basic':
				emp_hourly_ot_amount= (flt((d.e_modified_amount / (std_ot_days * std_ot_hours))*std_ot_rate))
				#frappe.errprint(['emp_hourly_ot_amount',emp_hourly_ot_amount])
				# emp_hourly_oth_amount= (flt((d.e_modified_amount / (std_ot_days * std_ot_hours))*std_oth_rate))
				emp_hourly_oth_amount= (flt((d.e_modified_amount / (std_ot_days * std_ot_hours))*std_oth_rate))
				#frappe.errprint(['emp_hourly_oth_amount',emp_hourly_oth_amount])
				emp_hourly_fot_amount= (flt((d.e_modified_amount / (std_ot_days * std_ot_hours))*fri_ot_rate))

			total_ot_amount=(emp_hourly_ot_amount* ot_hours) + (emp_hourly_oth_amount*oth_hours) + (emp_hourly_fot_amount*fot_hours)
			#frappe.errprint(['total_ot_amount',total_ot_amount])	
			#frappe.errprint(["ot_hours",ot_hours,"oth_hours",oth_hours,"emp_hourly_ot_amount",emp_hourly_ot_amount,"emp_hourly_oth_amount",emp_hourly_oth_amount,"emp_hourly_ot_amount* ot_hours",emp_hourly_ot_amount* ot_hours,"emp_hourly_oth_amount* ot_hours",emp_hourly_oth_amount* oth_hours])
			if d.e_type =='Overtime':
				d.e_amount=	total_ot_amount	
				d.e_modified_amount=total_ot_amount
		return "done"
		

	def calculate_ded_total(self):
		self.total_deduction = 0
		for d in self.get('deductions'):
			if cint(d.d_depends_on_lwp) == 1:
				d.d_modified_amount = rounded((flt(d.d_amount) * flt(self.payment_days)
					/ cint(self.total_days_in_month)), self.precision("d_modified_amount", "deductions"))
			elif not self.payment_days:
				d.d_modified_amount = 0
			elif not d.d_modified_amount:
				d.d_modified_amount = d.d_amount

			self.total_deduction += flt(d.d_modified_amount)

	def calculate_net_pay(self):
		disable_rounded_total = cint(frappe.db.get_value("Global Defaults", None, "disable_rounded_total"))
		#self.calculate_ovetime_total()
		self.calculate_earning_total()
		self.calculate_ded_total()
		data = {'employee':self.employee,'month':self.month,'gross_pay':self.gross_pay,'company':self.company,'days':self.total_days_in_month}
		salary = calculate_salary(data)
		self.salary_payable = flt(salary.get('salary_payable'))
		self.payment_days = salary.get('payment_days')
		self.net_pay = flt(salary.get('salary_payable'))- flt(self.total_deduction)
		self.rounded_total = rounded(self.net_pay,
			self.precision("net_pay") if disable_rounded_total else 0)

	def on_submit(self):
		if(self.email_check == 1):
			self.send_mail_funct()


	def send_mail_funct(self):
		receiver = frappe.db.get_value("Employee", self.employee, "company_email")
		if receiver:
			subj = 'Salary Slip - ' + cstr(self.month) +'/'+cstr(self.fiscal_year)
			frappe.sendmail([receiver], subject=subj, message = _("Please see attachment"),
				attachments=[frappe.attach_print(self.doctype, self.name, file_name=self.name)])
		else:
			msgprint(_("Company Email ID not found, hence mail not sent"))


@frappe.whitelist()
def salary_slip_calculation(data):
	data = json.loads(data)
	return calculate_salary(data)

def calculate_salary(data):
	payment_days = frappe.db.sql("""select count(name) from `tabAttendance`
									where status in ('Half Day', 'Present') and
									employee = '%s' and
									month(att_date) = %s and
									docstatus = 1
							"""%(data.get('employee'),data.get('month')),as_list=1)[0][0]
	if payment_days > 0:
		ot_values = frappe.db.get_values("Overtime Setting",{"company":data.get('company')},"*")

		monthly_salary = flt(data.get('gross_pay'))
		per_day_salary = flt(monthly_salary)/data.get('days')
		per_hr_salary = flt(per_day_salary)/flt(ot_values[0]['working_hours'])
		working_hours = ot_values[0]['working_hours']
		full_day_present = frappe.db.sql("select count(name) from `tabAttendance` where status = 'Present' and status != 'Half Day' and fot=0 and ot_hours=0 and holiday_ot_hours=0 and month(att_date) = %s and employee = '%s' and docstatus = 1"%(data.get('month'),data.get('employee')),as_list=1)[0][0]
		hf = 0

		hf = frappe.db.sql("select sum(hour(subtime(time_out,time_in))) as hr, \
			sum(minute(subtime(time_out,time_in))) as min, sum(second(subtime(time_out,time_in))) as sec from `tabAttendance` where status = 'Half Day' and fot=0 and ot_hours=0 and holiday_ot_hours=0 and month(att_date) = %s and employee = '%s' and docstatus = 1"%(data.get('month'),data.get('employee')),as_dict=1)[0]
		half_day_hr = 0

		if hf['hr'] != None:
			half_day_hr = float("{0:.2f}".format(hf['hr'] + hf['min']/60 + hf['sec']/3600))
		friday_ot = frappe.db.sql("select COALESCE(SUM(fot),0), count(name) from `tabAttendance` where fot >0 and month(att_date) = %s and employee = '%s' and status in ('Half Day', 'Present') and docstatus = 1"%(data.get('month'),data.get('employee')),as_list=1)[0]
		holiday_ot = frappe.db.sql("select COALESCE(sum(holiday_ot_hours),0),count(name) from `tabAttendance` where holiday_ot_hours >0 and month(att_date) = %s and employee = '%s' and status in ('Half Day', 'Present') and docstatus = 1"%(data.get('month'),data.get('employee')),as_list=1)[0]
		normal_ot = frappe.db.sql("select COALESCE(sum(ot_hours),0), count(name) from `tabAttendance` where ot_hours >0 and month(att_date) = %s and employee = '%s' and status in ('Half Day', 'Present') and docstatus = 1"%(data.get('month'),data.get('employee')),as_list=1)[0]
		
		full_day_sal = full_day_present * per_day_salary
		half_day_sal = half_day_hr * per_hr_salary
		holiday_ot_sal = (holiday_ot[0]) * ot_values[0]['holiday_ot_rate_for_hour'] * per_hr_salary
		normal_ot_sal = (normal_ot[0] * ot_values[0]['normal_ot_rate_for_hour']) + normal_ot[1] *  per_day_salary
		friday_ot_sal = (friday_ot[0]) * ot_values[0]['working_days'] * per_hr_salary

		total_ot_sal = holiday_ot_sal + normal_ot_sal + friday_ot_sal

		salary_payable = (full_day_sal + half_day_sal + holiday_ot_sal + normal_ot_sal + friday_ot_sal)

		return {"payment_days":payment_days, "salary_payable":salary_payable, "tot_ot": total_ot_sal}
	else:
		return {"payment_days":0, "salary_payable":0}