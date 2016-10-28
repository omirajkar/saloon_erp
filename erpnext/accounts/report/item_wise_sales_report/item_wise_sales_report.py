# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
	columns, data = [], []
	columns = get_columns()
	data = get_result(filters)

	total_qty = 0
	total_price = 0
	total_price_after_discount = 0
	for i in data:
		total_qty += i[5]
		total_price += i[6]
		total_price_after_discount += i[7]

	data.append(["<b>Total</b>","","","","",total_qty,total_price,total_price_after_discount])

	return columns, data

def get_columns():
	return [_("Invoice No") + ":Link/Sales Invoice:130", _("Customer") + ":Link/Customer:180", 
			_("Date") + ":Date:130", _("Item Code") + ":Item/Link:180", _("Item Name") + ":Data:170", 
			_("Qty") + ":Float:80", _("Price") + ":Currency:100", _("After Discount Price") + ":Currency:150"]

def get_result(filters):
	data = []
	conditions = get_conditions(filters)	
	data = frappe.db.sql("""select s.name, s.customer, s.posting_date, si.item_code, si.item_name, si.qty, 
					si.amount, si.net_amount from `tabSales Invoice` s, `tabSales Invoice Item` si where 
					s.name = si.parent and s.docstatus = 1 %s order by s.name desc """%(conditions), as_list=1)
	return data

def get_conditions(filters):
	conditions = ""
	if filters.get("from_date"): conditions += " and s.posting_date >= '%s'" %filters["from_date"]
	if filters.get("to_date"): conditions += " and s.posting_date <= '%s'" %filters["to_date"]
	if filters.get("item"): conditions += " and si.item_code = '%s'" %filters["item"]

	return conditions