# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
from frappe.utils import now, now_datetime
import frappe
import dateutil.relativedelta as relativedelta
from frappe.utils import flt, get_datetime, format_datetime, cstr
from datetime import datetime
from datetime import date, timedelta

def get_notification_config():
	#nexttime= add_minutes(now(), 20)
	today = datetime.now()
	today1 = today - timedelta(minutes = 150)
	nexttime = today + timedelta(minutes = 20)
	nexttime1 = nexttime - timedelta(minutes=150)
	abc = { "for_doctype":
		{
			"Issue": {"status": "Open"},
			"Warranty Claim": {"status": "Open"},
			"Task": {"status": "Open"},
			"Project": {"status": "Open"},
			"Lead": {"status": "Open"},
			"Contact": {"status": "Open"},
			"Opportunity": {"status": "Open"},
			"Quotation": {"docstatus": 0},
			"Sales Order": {
				"status": ("not in", ("Stopped", "Completed")),
				"docstatus": ("<", 2)
			},
			"Journal Entry": {"docstatus": 0},
			"Sales Invoice": { "outstanding_amount": (">", 0), "docstatus": ("<", 2) },
			"Purchase Invoice": {"docstatus": 0},
			"Leave Application": {"status": "Open"},
			"Expense Claim": {"approval_status": "Draft"},
			"Job Applicant": {"status": "Open"},
			"Purchase Receipt": {"docstatus": 0},
			"Delivery Note": {"docstatus": 0},
			"Stock Entry": {"docstatus": 0},
			"Material Request": {"docstatus": 0},
			"Purchase Order": {
				"status": ("not in", ("Stopped", "Completed")),
				"docstatus": ("<", 2)
			},
			"Production Order": { "status": "In Process" },
			"BOM": {"docstatus": 0},
			"Timesheet": {"docstatus": 0},
			"Time Log": {"status": "Draft"},
			"Time Log Batch": {"status": "Draft"},
			"Appointment": {
				"status": "Open",
				"starts":(">=",today1),
				"starts_on":("<=",nexttime1)
			}
		}
	}
	return abc
