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
		_("Posting Date") + ":Date:80",_("Item Name") + "::140",
		_("Incomming Qty") + ":Float:120",_("Outgoing Qty") + ":Float:120",
		_("Trade Price") + ":Currency:120",_("Retail Price") + ":Currency:120",
		_("Invoice") + ":Link/Sales Invoice:120",
	]



def get_result(filters):
	data = []
	pi_conditions = pi_get_conditions(filters)
	si_conditions = si_get_conditions(filters)		

	si = frappe.db.sql("""select s.posting_date,si.item_name,"",si.qty, 
					"",si.rate,s.name from `tabSales Invoice` s, `tabSales Invoice Item` si, tabItem item where 
					si.item_code = item.item_code and
					s.name = si.parent and item.item_group != 'Services' and s.docstatus = 1 %s """%(si_conditions), as_list=1)

	pi = frappe.db.sql("""select p.posting_date,pi.item_name, pi.qty, "",
					pi.rate,"",p.name from `tabPurchase Invoice` p, `tabPurchase Invoice Item` pi, tabItem item where  
					pi.item_code = item.item_code and p.name = pi.parent and item.item_group != 'Services' and p.docstatus = 1 %s """%(pi_conditions), as_list=1,debug=1)
	
	data = si + pi
	print "pi",pi
	# my_list =data
	print "data...",data,"\n"
	def getKey(item):
		return item[1]

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
	item = ""
	for i in my_list:
		if len(i)>0:
			if lp != i[1]:
				item = my_list[j][1]
				print "i am here",my_list[j][1]
				balance_qty = frappe.db.sql("""select qty_after_transaction from `tabStock Ledger Entry`
				where item_code=%s and is_cancelled='No'
				order by posting_date desc, posting_time desc, name desc
				limit 1""", (my_list[j][1]),as_dict=1)
				print balance_qty[0]['qty_after_transaction']
				balance_qty = str(balance_qty[0]['qty_after_transaction'])
				str_bal = "Balance Qty for " + my_list[j][1]
				my_list.insert((j),["",str_bal,balance_qty,"","","",""])
				#my_list.insert((j+1),["","Balance Qty",balance_qty,"","","",""])	
				lp = i[1]
		j = j+1

	# my_list.remove(my_list[0])
	# j = 0
	# my_list.remove(my_list[0])
	# for i in my_list:
	# 	if len(i)>0 and len(my_list[j])>0:
	# 		if my_list[j][1] == "Balance Qty for Laptop":
	# 			my_list.insert((j),["","","","","","",""])
	# 	j = j+1

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