from __future__ import unicode_literals
import frappe
from frappe.utils import flt, getdate, cstr
from frappe import _

def execute(filters=None):
	columns, data = [], []
	columns = get_columns()
	data = get_result(filters)

	return columns, data

def get_columns():
	return [_("Journal Entry") + ":Link/Journal Entry:120", _("Date") + ":Date:120", _("Customer") + ":Link/Customer:180", 
		_("Account") + ":Link/Account:120", _("Amount") + ":Currency:120", _("Reference No") + ":Data:100", \
		_("Reference Date") + ":Date:120"]

def get_result(filters):
	data = []
	
	data = frappe.db.sql("""select jv.name, jv.posting_date, jvi.party, jvi.account, jvi.credit_in_account_currency, 
		jv.cheque_no, jv.cheque_date from `tabJournal Entry` jv, `tabJournal Entry Account` jvi where jvi.parent = jv.name 
		and jvi.is_advance = 'Yes' and jvi.reference_name is null """,as_list=1)
	
	return data

