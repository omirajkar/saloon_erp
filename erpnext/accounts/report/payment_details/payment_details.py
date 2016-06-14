# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _ 

def execute(filters=None):
	columns, data = [], []
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_data(filters):
	result = []
	type_of_mode = frappe.db.sql(''' select name from `tabMode of Payment`''',as_list=1)
	result.append(filters.get('date'))
	for mode in type_of_mode:
		mode_amt = frappe.db.sql(""" 
							select 
							ifnull(sum(mop.amount),0) 
							from 
								`tabSales Invoice`si, 
								`tabMode of Pay`mop 
							where
								si.name = mop.parent
							and 
								mop.mode_of_payment = '%s'
							and 
								si.posting_date = '%s'
						"""%(mode[0], filters.get('date')),as_list=1)
		result.append(mode_amt[0][0])
	return [result]

def get_columns():
	type_of_mode = frappe.db.sql(''' select name from `tabMode of Payment`''',as_list=1)
	my_col = [("Date") + ":Date:"]
	for mode in type_of_mode:
		my_col.append((mode[0]) + ":Float:130")
	return my_col



