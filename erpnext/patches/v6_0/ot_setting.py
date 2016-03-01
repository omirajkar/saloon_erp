# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from erpnext.stock.stock_balance import repost_stock

def execute():
	# pass
	company = frappe.db.get_value("Global Defaults", None, ["default_company"])
	ot_setting = frappe.db.sql("""select name from `tabOvertime Setting`""",as_list=1)
	if not ot_setting and company:
		d = frappe.new_doc("Overtime Setting")
		d.normal_ot_rate_for_hour = 1.500
		d.holiday_ot_rate_for_hour = 2.000
		d.working_days = 1.500
		d.working_hours = 7
		d.company = company
		d.save(ignore_permissions=True)