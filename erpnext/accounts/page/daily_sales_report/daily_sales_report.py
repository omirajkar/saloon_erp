import frappe

@frappe.whitelist()
def single_emp_sales_details(emp=None, date=None):
	query = """	select DATE_FORMAT(s.posting_date,'%d-%m-%Y') as posting_date, i.emp, 
					case when i.income_account like 'Sales -%' 
						then sum(i.amount) else 0.00 END as tot_sales, 
					case when i.income_account like 'Service -%' 
						then sum(i.amount) else 0.00 END as tot_service 
				from 
					`tabSales Invoice Item` i, 
					`tabSales Invoice` s 
				where 
					s.name = i.parent
				and
					s.docstatus = 1 
				and
					(i.income_account like 'Sales -%' or i.income_account like 'Service -%')
			"""
	
	if emp: query += " and i.emp = '%s'"%(emp)
	if date: query += " and DATE_FORMAT(s.posting_date,'%d-%m-%Y') = '{0}'".format(date)
	query += " group by s.posting_date,i.emp,i.income_account"
	
	sales_details = frappe.db.sql(query,as_dict=True)
	
	sales_col_tot = service_col_tot = 0.00
	for d in sales_details:
		sales_col_tot += d['tot_sales']
		service_col_tot += d['tot_service']

	total = [{'sales_col_tot': sales_col_tot, "service_col_tot": service_col_tot}]
	return sales_details, total

@frappe.whitelist()
def get_mode_of_pay_details(date):
	query = """	select 
					m.mode_of_payment, sum(m.amount) as amount
				from 
					`tabSales Invoice` s 
				left join 
					`tabMode of Pay` m 
				on 
					s.name = m.parent 
				where
					s.docstatus = 1
				and
					DATE_FORMAT(s.posting_date,'%d-%m-%Y') = '{0}' 
				group by m.mode_of_payment
			""".format(date)
	mode_details = frappe.db.sql(query, as_dict=1)
	tot_amt = 0.00
	for amt in mode_details:
		if amt['amount']:
			tot_amt += amt['amount']
	total = [{'total': tot_amt}]
	return mode_details, total

@frappe.whitelist()
def get_all_emp_income_detail(date):
	query = """select 
					i.emp, 
				case when i.income_account like 'Sales -%' 
					then sum(i.amount) else 0.00 END as tot_sales, 
				case when i.income_account like 'Service -%' 
					then sum(i.amount) else 0.00 END as tot_service 
				from 
					`tabSales Invoice Item` i, 
					`tabSales Invoice` s 
				where s.name = i.parent and s.docstatus = 1
					and DATE_FORMAT(s.posting_date,'%d-%m-%Y') = '{0}'
				and
					(i.income_account like 'Sales -%' or i.income_account like 'Service -%')
				group by i.income_account, i.emp
			""".format(date)
	all_emp_detail = frappe.db.sql(query, as_dict=1);
	total = 0.00
	for e in all_emp_detail:
		e.update({'total': e['tot_sales'] + e['tot_service']})
		total += e['tot_sales'] + e['tot_service']
	return all_emp_detail, [{"total": total}]




# data = frappe.db.sql( """select sii.emp as employee,si.posting_date
# case when left(sii.income_account,7)='Sales -' then ifnull(sum(sii.base_net_amount),0) else 0 END as tot_sale,
# case when left(sii.income_account,9)='Service -' then ifnull(sum(sii.base_net_amount),0) else 0 END as total_ser from `tabSales Invoice`si,
# `tabSales Invoice Item`sii where si.name = sii.parent and si.posting_date='03-08-2016' group by si.posting_date,sii.emp,sii.income_account order by si.posting_date asc""")


# data = frappe.db.sql("select i.emp, i.income_account, case when left(i.income_account,5)='Sales' then ifnull(sum(i.amount),0) else 0 END as tot_sales, case when left(i.income_account,5)='Servi' then ifnull(sum(i.base_net_amount),0) else 0 END as tot_service, s.posting_date from `tabSales Invoice Item` i, `tabSales Invoice` s where s.name = i.parent and i.emp = 'Sangram' group by s.posting_date,i.emp,i.income_account")
#2016-08-04