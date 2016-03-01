# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from erpnext.stock.stock_balance import repost_stock

def execute():
	pass
	# status_dict = [["Present",1],["Half Day",1],["Absent",0],["Weekly Off",0],["Leave Without Pay",0]]
	# att_status = frappe.db.sql("""select name from `tabAttendance Status`""",as_list=1)
	# if not att_status:
	# 	for i in status_dict:
	# 		d = frappe.new_doc("Attendance Status")
	# 		d.status = i[0]
	# 		d.paid = i[1]
	# 		d.save(ignore_permissions=True)