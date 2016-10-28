# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt

def execute(filters=None):
	if not filters: filters = {}
	columns = get_columns()
	last_col = len(columns)
	# All items
	items = frappe.db.sql(""" select item_code from `tabItem`""",as_dict=1,debug=1)

	data = []
	list1 = []

	for i in items:
		item_list = get_items(filters,i.item_code)
		list1.extend(item_list)


		
	for d in list1:
		print "d..",d,"\n"
		# if d.item_code:
		row = [d.item_name, d.posting_date, 
		  d.qty, d.base_net_rate, d.base_net_amount,d.parent]


		data.append(row)

	return columns, data

def get_columns():
	return [
		_("Item Name") + "::120",_("Posting Date") + ":Date:80",
		_("Qty") + ":Float:120",
		_("Rate") + ":Currency:120", _("Amount") + ":Currency:120",
		_("Invoice") + ":Link/Sales Invoice:120",
	]


def get_items(filters,item_code):
	
	print item_code,"...","item_code"

	s = frappe.db.sql("""select si_item.parent, si.posting_date, si.debit_to, 
		si.customer, si.base_net_total, si_item.item_code, si_item.item_name,
		si_item.sales_order, si_item.delivery_note, 
		si_item.qty, si_item.base_net_rate, si_item.base_net_amount, si.customer_name,
		si_item.so_detail
		from `tabSales Invoice` si, `tabSales Invoice Item` si_item
		where si.name = si_item.parent and si.docstatus = 1 and si.posting_date >= "{0}" and si.posting_date <= "{1}"
		and si_item.item_code = "{2}"
		order by si.posting_date desc, si_item.item_code desc """.format(filters['from_date'],filters['to_date'],item_code), as_dict=1,debug=1)
	
	print s,"ssssssssssssssss","\n"

	p = frappe.db.sql("""select pi_item.parent, pi.posting_date, 
		pi.base_net_total, pi_item.item_code, pi_item.item_name,
		pi_item.purchase_order,
		pi_item.qty, pi_item.base_net_rate, pi_item.base_net_amount
		
		from `tabPurchase Invoice` pi, `tabPurchase Invoice Item` pi_item
		where pi.name = pi_item.parent and pi.docstatus = 1 and pi.posting_date >= "{0}" and pi.posting_date <= "{1}"
		and pi_item.item_code = "{2}"
		order by pi.posting_date desc, pi_item.item_code desc """.format(filters['from_date'],filters['to_date'],item_code), as_dict=1,debug=1)
	
	print p,'pppppppppppppppppppppppp',"\n"

	
	s.extend(p)
	return s

