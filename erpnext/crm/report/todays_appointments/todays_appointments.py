from __future__ import unicode_literals
import frappe
from frappe.utils import flt, getdate, cstr
from frappe import _
from datetime import date, timedelta
from datetime import datetime
#from frappe.utils import now, add_minutes

def execute(filters=None):
	columns, data = [], []
	columns = get_columns()
	data = get_result(filters)

	return columns, data

def get_columns():
	return [_("Subject") + ":data:200",_("Status") + ":data:100", _("Customer") + ":Link/Customer:150", 
		_("Starts On") + ":Datetime:150", _("Ends On") + ":Datetime:150", _("Attended By") + ":Link/Employee:120", 
		_("Service") + ":data:250"]

def get_result(filters):
	data = []
	
	today = datetime.now()
	today1 = today - timedelta(minutes = 150)
	nexttime = today + timedelta(minutes = 20)
	nexttime1 = nexttime - timedelta(minutes=150)

	company = frappe.get_value("User", frappe.session.user, "company")
	
	data = frappe.db.sql("""select subject, status, customer, starts_on, ends_on, employee, total_services from 
		`tabAppointment` where status = 'Open' and starts_on <= '%s' and starts_on >= '%s'order by starts_on asc """%(nexttime1,today1),as_list=1)
	
	return data

