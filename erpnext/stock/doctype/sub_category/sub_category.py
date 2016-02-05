# -*- coding: utf-8 -*-
# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class SubCategory(Document):
	# pass
	def autoname(self):
		self.name = self.category_name + '-' + self.sub_category_name
