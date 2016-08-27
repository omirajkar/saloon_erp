# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe

from frappe.utils import getdate, nowdate, flt,cstr ,get_time
from frappe import _
from frappe.model.document import Document
from erpnext.hr.utils import set_employee_name
import datetime
from frappe.utils import add_days, getdate, formatdate, get_first_day, get_last_day

class Attendance(Document):
	def validate_duplicate_record(self):
		res = frappe.db.sql("""select name from `tabAttendance` where employee = %s and att_date = %s
			and name != %s and docstatus = 1""",
			(self.employee, self.att_date, self.name))
		if res:
			frappe.throw(_("Attendance for employee {0} is already marked").format(self.employee))

		set_employee_name(self)

	def check_leave_record(self):
		if self.status == 'Present':
			leave = frappe.db.sql("""select name from `tabLeave Application`
				where employee = %s and %s between from_date and to_date and status = 'Approved'
				and docstatus = 1""", (self.employee, self.att_date))

			if leave:
				frappe.throw(_("Employee {0} was on leave on {1}. Cannot mark attendance.").format(self.employee,
					self.att_date))

	def validate_att_date(self):
		if getdate(self.att_date) > getdate(nowdate()):
			if  ('System Manager' or 'Admin' ) not in frappe.get_roles() :
				frappe.errprint(frappe.get_roles())
				frappe.throw(_("Attendance can not be marked for future dates"))

	def validate_inout(self):
		if ((self.time_in and self.time_out) and (get_time(self.time_in) > get_time(self.time_out))):
			frappe.throw(_("'Time In' ({0}) cannot be greater than 'Time Out' ({1})").format(self.time_in,
					self.time_out))

		if ((not self.time_out or not self.time_in) and self.status in ('Present', 'Half Day')):
			frappe.throw(_("Please enter 'Time In' and 'Time Out'"))

	def validate_employee(self):
		emp = frappe.db.sql("select name from `tabEmployee` where name = %s and status = 'Active'",
		 	self.employee)
		if not emp:
			frappe.throw(_("Employee {0} is not active or does not exist").format(self.employee))

	def validate(self):
		from erpnext.controllers.status_updater import validate_status
		from erpnext.accounts.utils import validate_fiscal_year
		# validate_status(self.status, ["Present", "Absent", "Half Day"])
		validate_fiscal_year(self.att_date, self.fiscal_year, _("Attendance Date"), self)
		self.validate_att_date()
		self.validate_duplicate_record()
		self.check_leave_record()
		self.validate_inout()
		self.calculate_ot()
		self.get_employee_holidays()
		self.min_working_hours()
	
	def get_employee_holidays(self):
		first_day = get_first_day(self.att_date)
		last_day = get_last_day(self.att_date)
		
		holidays = frappe.db.sql("""select t1.holiday_date from `tabHoliday` t1, tabEmployee t2 where 
			t1.parent = t2.holiday_list and t2.name = %s and t1.holiday_date between %s and %s""",(self.employee, first_day, last_day))
		holidays = [cstr(i[0]) for i in holidays]

		if self.status in ('Weekly Off', 'Public Holiday') and self.att_date not in holidays:
			frappe.throw(_("This date not present in Holiday list.Please select correct date.."))
	
	def on_update(self):
		# this is done because sometimes user entered wrong employee name
		# while uploading employee attendance
		employee_name = frappe.db.get_value("Employee", self.employee, "employee_name")
		frappe.db.set(self, 'employee_name', employee_name)

	def calculate_ot(self):
		# calculate OT worked hours
		h_list=frappe.db.sql("""select holiday_list from `tabEmployee` where name = '%s'"""%(self.employee),as_list=1)
		if self.time_in and self.time_out:
			time_in = self.att_date+" "+self.time_in
			time_out = self.att_date+" "+self.time_out
			start = datetime.datetime.strptime(time_in, '%Y-%m-%d %H:%M:%S')
			ends = datetime.datetime.strptime(time_out, '%Y-%m-%d %H:%M:%S')
			diff =  ends - start
			hrs=cstr(diff).split(':')[0]
			mnts=cstr(diff).split(':')[1]
			std_ot_hours=frappe.db.get_value("Overtime Setting", self.company, "working_hours")

			if not std_ot_hours :
				frappe.throw(_("Please set Overtime Settings first..."))
				
			if not std_ot_hours:
				std_ot_hours=frappe.db.get_value("Overtime Setting", 'vlinku', "working_hours")
			if h_list:
				is_holiday=frappe.db.sql("select h.description from `tabHoliday List` hl ,`tabHoliday` h where hl.name=h.parent and h.holiday_date='%s' and hl.name='%s' and h.description not in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')" %(self.att_date,h_list[0][0]))
				is_fot=frappe.db.sql("select h.description from `tabHoliday List` hl ,`tabHoliday` h where hl.name=h.parent and h.holiday_date='%s' and hl.name='%s'  and h.description in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')" %(self.att_date,h_list[0][0]),as_list=1)
			
			if flt(std_ot_hours)>=flt(hrs+"."+mnts) :
				hours=0.0
			else: 
				hours=flt(hrs+"."+mnts)-flt(std_ot_hours)

			if is_holiday:
				day = datetime.datetime.strptime(self.att_date, '%Y-%m-%d').strftime('%A')
				if day == 'Friday':
					self.holiday_ot_hours = '0.0'
					self.ot_hours = '0.0'
					self.fot = flt(hrs+"."+mnts)
				else:
					self.holiday_ot_hours = flt(hrs+"."+mnts)
					self.ot_hours='0.0'
					self.fot='0.0'
			else:
				if is_fot:
					if is_fot[0][0]=="Friday":
						self.ot_hours = '0.0'
						self.holiday_ot_hours='0.0'
						self.fot=flt(hrs+"."+mnts)
				else:
					self.ot_hours = hours
					self.holiday_ot_hours='0.0'
					self.fot='0.0'

	def min_working_hours(self):
		if self.time_in and self.time_out:
			time_in = self.att_date+" "+self.time_in
			time_out = self.att_date+" "+self.time_out
			start = datetime.datetime.strptime(time_in, '%Y-%m-%d %H:%M:%S')
			ends = datetime.datetime.strptime(time_out, '%Y-%m-%d %H:%M:%S')
			self.total_hours = ends - start

			diff =  ends - start
			hrs=cstr(diff).split(':')[0]
			mnts=cstr(diff).split(':')[1]

			min_hrs = frappe.db.get_value("Overtime Setting", self.company, "minimum_working_hours")
			if min_hrs :
				if min_hrs > (flt(hrs+"."+mnts)) and self.status == 'Present':
					frappe.throw(_("Working hours are not completed for this employee..So attendance must mark for Half Day"))
			else:
				frappe.throw(_("Please set Minimum Working Hours in Overtime Settings"))

@frappe.whitelist()
def get_logo():
	"""
		This function is to set custom company logo
	"""
	# company = frappe.db.sql("""select name from `tabCompany` """, as_list=1)
	logo = frappe.db.sql("""select file_name from `tabFile` where attached_to_doctype = 'Company' """,as_list=1)
	if logo:
		company_logo = logo[0][0]
		return company_logo

	# if frappe.session['user']:
	# 	company = frappe.db.sql("select company from `tabUser` where name = '%s'"%(frappe.session['user']),as_list=1)
	# 	if company:
	# 		logo = frappe.db.sql("""select file_name from `tabFile` where attached_to_doctype = 'Company' and 
	# 			attached_to_name = '%s'"""%(company[0][0]),as_list=1)
	# 		if logo:
	# 			company_logo = logo[0][0]
	# 			return company_logo



def get_permission_query_conditions(user):
	return """(`tabEmployee`.status = 'Active')"""