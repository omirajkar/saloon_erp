# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
	columns = get_columns()
	sl_entries = get_stock_ledger_entries(filters)
	item_details = get_item_details(filters)
	opening_row = get_opening_balance(filters, columns)
	
	data = []
	
	if opening_row:
		data.append(opening_row)

	for sle in sl_entries:
		print "sle",sle
		item_detail = item_details[sle.item_code]

		# data.append([sle.date, sle.item_code, item_detail.item_name, item_detail.item_group,
		# 	item_detail.brand, item_detail.description, sle.warehouse,
		# 	item_detail.stock_uom, sle.actual_qty, sle.qty_after_transaction,
		# 	(sle.incoming_rate if sle.actual_qty > 0 else 0.0),
		# 	sle.valuation_rate, sle.stock_value, sle.voucher_type, sle.voucher_no,
		# 	sle.batch_no, sle.serial_no, sle.company])

		data.append([sle.date, sle.item_code, 
			sle.incoming_qty,sle.outgoing_qty,
			sle.trade_price,(sle.price),
			sle.warehouse,sle.voucher_type, sle.voucher_no,sle.qty_after_transaction,])

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

	print "\nmy_list",my_list
	print "\data",data


	my_new_list = []
	my_list.remove(my_list[0])
	j=0
	lp=my_list[0][1]
	item = ""
	# print "\n\nmy_list[j][1]",my_list[0][1]
	for i in my_list:
		if len(i)>0:
			if lp != i[1]:
				item = my_list[j][1]
				k=j-1
				my_new_list.append(["","<b>Balance Qty</b>",my_list[k][9],"","","","",""])
				my_new_list.append(["","","","","","","",""])

				#my_list.insert((j+1),["","Balance Qty",balance_qty,"","","",""])	
				lp = i[1]
		my_new_list.append(i)
		j = j+1
	my_new_list.append(["","<b>Balance Qty</b>",my_list[-1][9],"","","","",""])

	# y = 0

	print "\n\nmynewlist",my_new_list
	# for x in my_list:
	# 	if len(x)>0:
	# 		print "\n",my_list[y]
	# 		my_list.insert((y),["","","","","","","",""])

	# 	y += 1
	# my_list.remove(my_list[0])
	# print "data",data
	return columns, my_new_list

def get_columns():
	return [_("Date") + ":Datetime:95", _("Item") + ":Link/Item:130",
		_("Incoming Qty") + ":Float:60", 
		_("Outgoing Qty") + ":Float:60", 
		_("Trade Price") + ":Currency:110",_("Retail Price") + ":Currency:110",
		_("Warehouse") + ":Link/Warehouse:100",
		_("Voucher Type") + "::110", 
		_("Voucher #") + ":Dynamic Link/Voucher Type:100",
		_("Balance Qty") + ":Float:100"
	]

def get_stock_ledger_entries(filters):
	if filters.get("supplier"):
		return frappe.db.sql("""select concat_ws(" ", sle.posting_date, sle.posting_time) as date,
				sle.item_code, sle.warehouse, sle.actual_qty, sle.qty_after_transaction, sle.incoming_rate,
				CASE         
				     WHEN sle.actual_qty > 0 
				     THEN (sle.actual_qty)         
				     ELSE ""     
				     END AS incoming_qty,
				CASE         
				     WHEN sle.actual_qty < 0 
				     THEN (-sle.actual_qty)         
				     ELSE ""     
				     END AS outgoing_qty,
				CASE         
				     WHEN sle.voucher_type = "Sales invoice" 
				     THEN (select rate from `tabSales Invoice Item` sii where sii.parent=sle.voucher_no and sii.item_code=sle.item_code limit 1)         
				     WHEN sle.voucher_type = "Purchase Receipt" 
				     THEN (select rate from `tabPurchase Receipt Item` pri where pri.parent=sle.voucher_no and pri.item_code=sle.item_code limit 1)             
				     WHEN sle.voucher_type = "Delivery Note" 
				     THEN (select rate from `tabDelivery Note Item` dni where dni.parent=sle.voucher_no and dni.item_code=sle.item_code limit 1)                  
				     ELSE ""     
				     END AS price,
			stock_value, sle.voucher_type, voucher_no, batch_no, serial_no, sle.company
		from `tabStock Ledger Entry` sle, `tabPurchase Receipt` pr
		where sle.company = %(company)s and
			sle.posting_date between %(from_date)s and %(to_date)s
			and sle.voucher_type = 'Purchase Receipt' 
			and sle.voucher_no = pr.name and pr.supplier = %(supplier)s
			{sle_conditions}
			order by sle.posting_date asc, sle.posting_time asc, name asc""".format(sle_conditions=get_sle_conditions(filters)), filters, as_dict=1)

	return frappe.db.sql("""select concat_ws(" ", posting_date, posting_time) as date,
			item_code, warehouse, actual_qty, qty_after_transaction, incoming_rate, valuation_rate,
				CASE         
				     WHEN sle.actual_qty > 0 
				     THEN (sle.actual_qty)         
				     ELSE ""     
				     END AS incoming_qty,
				CASE         
				     WHEN sle.actual_qty < 0 
				     THEN (-sle.actual_qty)         
				     ELSE ""     
				     END AS outgoing_qty,
				CASE         
				     WHEN sle.voucher_type = "Sales invoice" 
				     THEN (select rate from `tabSales Invoice Item` sii where sii.parent=sle.voucher_no and sii.item_code=sle.item_code limit 1)         
				     WHEN sle.voucher_type = "Delivery Note" 
				     THEN (select rate from `tabDelivery Note Item` dni where dni.parent=sle.voucher_no and dni.item_code=sle.item_code limit 1)                  
				     ELSE ""     
				     END AS price,
				CASE         
					WHEN sle.voucher_type = "Purchase Receipt" 
				     THEN (select rate from `tabPurchase Receipt Item` pri where pri.parent=sle.voucher_no and pri.item_code=sle.item_code limit 1)         
				     ELSE ""     
				     END AS trade_price,
			stock_value, sle.voucher_type, voucher_no, batch_no, serial_no, company
		from `tabStock Ledger Entry` sle
		where company = %(company)s and
			posting_date between %(from_date)s and %(to_date)s
			{sle_conditions}
			order by posting_date asc, posting_time asc, name asc"""\
		.format(sle_conditions=get_sle_conditions(filters)), filters, as_dict=1)

def get_item_details(filters):
	item_details = {}
	for item in frappe.db.sql("""select name, item_name, description, item_group,
			brand, stock_uom from `tabItem` {item_conditions}"""\
			.format(item_conditions=get_item_conditions(filters)), filters, as_dict=1):
		item_details.setdefault(item.name, item)

	return item_details

def get_item_conditions(filters):
	conditions = []
	if filters.get("item_code"):
		conditions.append("name=%(item_code)s")
	if filters.get("brand"):
		conditions.append("brand=%(brand)s")

	return "where {}".format(" and ".join(conditions)) if conditions else ""

def get_sle_conditions(filters):
	conditions = []
	item_conditions=get_item_conditions(filters)
	if item_conditions:
		conditions.append("""sle.item_code in (select name from tabItem
			{item_conditions})""".format(item_conditions=item_conditions))
	if filters.get("warehouse"):
		conditions.append("warehouse=%(warehouse)s")
	if filters.get("voucher_no"):
		conditions.append("voucher_no=%(voucher_no)s")

	return "and {}".format(" and ".join(conditions)) if conditions else ""

def get_opening_balance(filters, columns):
	if not (filters.item_code and filters.warehouse and filters.from_date):
		return

	from erpnext.stock.stock_ledger import get_previous_sle
	last_entry = get_previous_sle({
		"item_code": filters.item_code,
		"warehouse": filters.warehouse,
		"posting_date": filters.from_date,
		"posting_time": "00:00:00"
	})
	
	row = [""]*len(columns)
	row[1] = _("'Opening'")
	for i, v in ((9, 'qty_after_transaction'), (11, 'valuation_rate'), (12, 'stock_value')):
			row[i] = last_entry.get(v, 0)
		
	return row