frappe.ui.form.on("Sales Closure", {
	refresh: function(frm) {
		cur_frm.toggle_display('sales_closure_date', frm.doc.sales_closure == "Yes");
		if(frm.doc.sales_closure == "Yes") {
			frm.doc.sales_closure_date = get_today();
			cur_frm.set_df_property('sales_closure_date', 'read_only', 1);
		}
		if(frm.doc.sales_closure == "No"){
			frm.doc.sales_closure_date = ''
			cur_frm.set_df_property('sales_closure_date', 'read_only', 0);
		}
	}/*,

	validate: function(frm) {
		
	}*/

})