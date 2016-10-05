# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
	columns, data = [], []
	columns = get_columns()
	data = get_result(filters)

	return columns, data

def get_columns():
	return [_("Customer") + ":Link/Customer:180", _("Cash") + ":Currency:120", _("KNET") + ":Currency:120",  
			_("Credit Card") + ":Currency:120", 	_("Check") + ":Currency:120"]

def get_result(filters):
	data = []
	conditions = get_conditions(filters)	
	customer = frappe.db.get_all("Customer","name")
	if customer:
		for cust in customer:
			row = []
			cash = frappe.db.sql(""" select ifnull(sum(mop.amount),0) from `tabSales Invoice` s, `tabMode of Pay` mop 
					where s.customer = '%s' and mop.mode_of_payment = "Cash" and s.name = mop.parent and 
						s.docstatus = 1 %s """%(cust.get('name'),conditions), as_list=1)

			knet = frappe.db.sql(""" select ifnull(sum(mop.amount),0) from `tabSales Invoice` s, `tabMode of Pay` mop 
					where s.customer = '%s' and mop.mode_of_payment = "KNET" and s.name = mop.parent and 
						s.docstatus = 1 %s """%(cust.get('name'),conditions), as_list=1)

			credit_card = frappe.db.sql(""" select ifnull(sum(mop.amount),0) from `tabSales Invoice` s, 
					`tabMode of Pay` mop where s.customer = '%s' and mop.mode_of_payment = "Credit Card" and 
						s.name = mop.parent and s.docstatus = 1 %s """%(cust.get('name'),conditions), as_list=1)

			cheque = frappe.db.sql(""" select ifnull(sum(mop.amount),0) from `tabSales Invoice` s, `tabMode of Pay` mop 
					where s.customer = '%s' and mop.mode_of_payment = "Cheque" and s.name = mop.parent and 
						s.docstatus = 1 %s """%(cust.get('name'),conditions), as_list=1)
			row.append(cust.get('name'))
			row.append(cash[0][0])
			row.append(knet[0][0])
			row.append(credit_card[0][0])
			row.append(cheque[0][0])
			data.append(row)
	return data

def get_conditions(filters):
	conditions = ""
	if filters.get("from_date"): conditions += " and s.posting_date >= '%s'" %filters["from_date"]
	if filters.get("to_date"): conditions += " and s.posting_date <= '%s'" %filters["to_date"]

	return conditions
