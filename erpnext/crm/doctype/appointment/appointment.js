
frappe.ui.form.on("Appointment", "validate", function(frm,doc) {
    if(frm.doc.starts_on && frm.doc.ends_on){
		if(frm.doc.starts_on >frm.doc.ends_on){
			msgprint(__("Start Time should be greater than End Time"));
			validated = false;
		}
	}
});

frappe.ui.form.on("Appointment", "starts_on", function(frm,doc) {
    if(frm.doc.starts_on){
		frm.doc.starts = frm.doc.starts_on 
	}
});

frappe.ui.form.on("Appointment", "refresh", function(frm,doc) {
    if((frm.doc.status=='Cancel') || (frm.doc.status=='Completed')){
		cur_frm.set_df_property('customer', 'read_only', 1);
		cur_frm.set_df_property('starts_on', 'read_only', 1);
		cur_frm.set_df_property('ends_on', 'read_only', 1);
		cur_frm.set_df_property('employee', 'read_only', 1);
		cur_frm.set_df_property('company', 'read_only', 1);
		cur_frm.set_df_property('service', 'read_only', 1);
		cur_frm.set_df_property('status', 'read_only', 1);
		cur_frm.set_df_property('appointment_type', 'read_only', 1);
		refresh_field("customer")
		refresh_field("starts_on")
		refresh_field("ends_on")
		refresh_field("employee")
		refresh_field("company")
		refresh_field("service")
		refresh_field("status")
		refresh_field("appointment_type")
	}
});

cur_frm.fields_dict.customer.get_query = function(doc) {
	return {
		query: "erpnext.crm.doctype.appointment.appointment.get_mob_no"
	}
}

frappe.ui.form.on("Appointment", "customer", function(frm,doc) {
    frappe.call({
		method: "erpnext.crm.doctype.appointment.appointment.get_customer_mobile",
		args: {
			"customer": frm.doc.customer
		},
		callback: function(r) {
			if(r.message) {
				if (frm.doc.appointment_type=='Home Service'){
					frm.doc.customer_mobile_no = r.message[0][0]
					refresh_field("customer_mobile_no")
				}
				else{
					frm.doc.customer_mobile_no = ''
					refresh_field("customer_mobile_no")
				}
			}
			else{
				frm.doc.customer_mobile_no = ''
				refresh_field("customer_mobile_no")
			}
		}
	});

	frappe.call({
		method: "erpnext.crm.doctype.appointment.appointment.get_address",
		args: {
			"customer": frm.doc.customer
		},
		callback: function(r) {
			if(r.message) {
				if (frm.doc.appointment_type=='Home Service'){
					frm.doc.address_display = r.message
					refresh_field("address_display")
				}
				else{
					frm.doc.address_display = ''
					refresh_field("address_display")
				}
			}
			else{
				frm.doc.address_display = ''
				refresh_field("address_display")
			}
		}
	});
});

frappe.ui.form.on("Appointment", "appointment_type", function(frm,doc) {
    frappe.call({
		method: "erpnext.crm.doctype.appointment.appointment.get_customer_mobile",
		args: {
			"customer": frm.doc.customer
		},
		callback: function(r) {
			if(r.message) {
				if (frm.doc.appointment_type=='Home Service'){
					frm.doc.customer_mobile_no = r.message[0][0]
					refresh_field("customer_mobile_no")
				}
				else{
					frm.doc.customer_mobile_no = ''
					refresh_field("customer_mobile_no")
				}
			}
		}
	});

	frappe.call({
		method: "erpnext.crm.doctype.appointment.appointment.get_address",
		args: {
			"customer": frm.doc.customer
		},
		callback: function(r) {
			if(r.message) {
				if (frm.doc.appointment_type=='Home Service'){
					frm.doc.address_display = r.message
					refresh_field("address_display")
				}
				else{
					frm.doc.address_display = ''
					refresh_field("address_display")
				}
			}
		}
	});
});
