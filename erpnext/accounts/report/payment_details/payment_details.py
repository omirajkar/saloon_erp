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
	total_amount=0.000
	employees = frappe.db.sql(""" 
							select 
							sii.emp as Employee,
							case when left(sii.income_account,5)='Sales' then ifnull(sum(sii.amount),0) else 0 END as `Total Sales`,
							case when left(sii.income_account,5)='Service' then ifnull(sum(sii.amount),0) else 0 END as `Total Service`
							
							from 
								`tabSales Invoice`si, 
								`tabSales Invoice Item`sii
							where
								si.name = sii.parent
							        and si.posting_date='%s'
								group by si.posting_date,sii.emp,sii.income_account
							order by si.posting_date asc
						"""%(filters.get('date')),as_list=1)

	mode_pays=frappe.db.sql("""
							select 
							mop.mode_of_payment,
							ifnull(sum(mop.amount),0) as Sales,
							'0.000' as Service
							from 
								`tabSales Invoice`si, 
								`tabMode of Pay`mop 
							where
								si.name = mop.parent
							and 
								si.posting_date = '%s'
								group by mop.mode_of_payment
							order by si.posting_date asc
							"""%(filters.get('date')),as_list=1)
	result=employees+mode_pays
	frappe.errprint(result)
	return result

def get_columns():
	my_col = ["Particular:Link/Employee:100","Total Sales:Currency:100","Total Service:Currency:100"]
	return my_col
