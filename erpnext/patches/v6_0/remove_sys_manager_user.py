# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from erpnext.stock.stock_balance import repost_stock

def execute():
	pass
	# user_list = frappe.db.sql("""select name from `tabUser`""",as_list=1)
	# for user in user_list:
	# 	if user[0] == 'shakeel.viam@vlinku.com':
	# 		frappe.delete_doc("User", 'shakeel.viam@vlinku.com')
