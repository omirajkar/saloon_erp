# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
	columns, data = [], []
	columns = get_columns()
	data = get_result(filters)

	# total_qty = 0
	# total_price = 0
	# total_price_after_discount = 0
	# for i in data:
	# 	total_qty += i[5]
	# 	total_price += i[6]
	# 	total_price_after_discount += i[7]

	# data.append(["<b>Total</b>","","","","",total_qty,total_price,total_price_after_discount])

	return columns, data

def get_columns():
	return [
		_("Item Name") + "::120",_("Posting Date") + ":Date:80",
		_("Qty") + ":Float:120",
		_("Rate") + ":Currency:120", _("Amount") + ":Currency:120",
		_("Invoice") + ":Link/Sales Invoice:120",
	]



def get_result(filters):
	data = []
	pi_conditions = pi_get_conditions(filters)
	si_conditions = si_get_conditions(filters)		

	si = frappe.db.sql("""select si.item_name, s.posting_date,si.qty, 
					si.amount, si.net_amount,s.name from `tabSales Invoice` s, `tabSales Invoice Item` si where 
					s.name = si.parent and s.docstatus = 1 %s """%(si_conditions), as_list=1)

	pi = frappe.db.sql("""select pi.item_name, p.posting_date,pi.qty, 
					pi.amount, pi.net_amount,p.name from `tabPurchase Invoice` p, `tabPurchase Invoice Item` pi where 
					p.name = pi.parent and p.docstatus = 1 %s """%(pi_conditions), as_list=1,debug=1)
	
	data = si + pi
	print "data...",data,"\n"
	def getKey(item):
		return item[0]

	data= sorted(data, key=getKey)
	from collections import defaultdict
	d = defaultdict(list)
	for row in data:
		d[row[1]].append(row)

	my_list = [[]]
	for key in d.values():
		if len(key)>1:
			print my_list.extend(key)

	print "my_list",my_list
	j=0
	lp=""
	for i in my_list:
		if len(i)>0:
			if lp != i[1]:
				my_list.insert((j),["","","","","",""])
				lp = i[1]
		j = j+1

	my_list.remove(my_list[0])
	return my_list

def si_get_conditions(filters):
	conditions = ""
	if filters.get("from_date"):
		conditions += " and s.posting_date >= '%s'" %filters.get("from_date")
	if filters.get("to_date"):
		conditions += " and s.posting_date <= '%s'" %filters.get("to_date")
	if filters.get("item_code"):
		conditions += """ and si.item_code = '{0}'""".format(filters.get("item_code"))
	print "\n\ncon",conditions
	return conditions

def pi_get_conditions(filters):
	conditions = ""
	if filters.get("from_date"): conditions += " and p.posting_date >= '%s'" %filters["from_date"]
	if filters.get("to_date"): conditions += " and p.posting_date <= '%s'" %filters["to_date"]
	if filters.get("item_code"):
		conditions += """ and pi.item_code = '{0}'""".format(filters.get("item_code"))
	if filters.get("supplier"):
		conditions += """ and p.supplier = '{0}'""".format(filters.get("supplier"))

	return conditions