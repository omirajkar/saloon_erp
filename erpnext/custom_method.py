import frappe
import json
import frappe.utils
from frappe import _
from frappe.model.naming import make_autoname
import frappe.defaults
from frappe.utils import encode

def add_mode_of_payment(doc,method):
	if doc.advances:
		for i in range(len(doc.advances)):
			jv_doc = frappe.get_doc("Journal Entry",doc.advances[i].journal_entry)
			doc.advances[i].mode_of_payment = jv_doc.mode_of_payment