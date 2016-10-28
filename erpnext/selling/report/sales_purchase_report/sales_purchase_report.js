// Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.query_reports["Sales-Purchase Report"] = {
	"filters": [
		{
			"fieldname":"company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("company"),
			"reqd": 1,
			"hidden":1,
			"read_only":1
		},
		{
			"fieldname":"from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			"reqd": 1
		},
		{
			"fieldname":"to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		},
		// {
		// 	"fieldname":"warehouse",
		// 	"label": __("Warehouse"),
		// 	"fieldtype": "Link",
		// 	"options": "Warehouse"
		// },
		{
			"fieldname":"item_code",
			"label": __("Item"),
			"fieldtype": "Link",
			"options": "Item"
		},
		// {
		// 	"fieldname":"brand",
		// 	"label": __("Brand"),
		// 	"fieldtype": "Link",
		// 	"options": "Brand"
		// },
		// {
		// 	"fieldname":"voucher_no",
		// 	"label": __("Voucher #"),
		// 	"fieldtype": "Data"
		// },
		// {
		// 	"fieldname":"supplier",
		// 	"label": __("Supplier"),
		// 	"fieldtype": "Link",
		// 	"options": "Supplier"
		// },
	]
}

// $(function() {
// 	$(wrapper).bind("show", function() {
// 		frappe.query_report.load();
// 	});
// });