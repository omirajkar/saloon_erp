from __future__ import unicode_literals
import json
import pdfkit, os, frappe
from frappe.utils import cstr
from frappe import _
from frappe.utils.pdf import get_pdf
from frappe.utils.csvutils import UnicodeWriter
import datetime

@frappe.whitelist()
def single_emp_sales_details(emp=None, from_date=None, to_date=None, mode_of_pay=None):
	employee_query = """	select DATE_FORMAT(s.posting_date,'%d-%m-%Y') as posting_date, i.emp, 
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
	
	if emp: employee_query += " and i.emp = '%s'"%(emp)
	
	if from_date:
		from_date = datetime.datetime.strptime(from_date, '%d-%m-%Y').strftime('%Y-%m-%d')
		employee_query += " and s.posting_date >= '{0}'".format(from_date)

	if to_date:
		to_date = datetime.datetime.strptime(to_date, '%d-%m-%Y').strftime('%Y-%m-%d')
		employee_query += " and s.posting_date <= '{0}'".format(to_date)

	employee_query += " group by s.posting_date,i.emp,i.income_account"

	sales_details = frappe.db.sql(employee_query,as_dict=True)




	sales_col_tot = service_col_tot = 0.00
	for d in sales_details:
		sales_col_tot += d['tot_sales']
		service_col_tot += d['tot_service']

	for i in sales_details:
		i["tot_sales"] = '%.3f' % i["tot_sales"]
		i["tot_service"] = '%.3f' % i["tot_service"]
		
	sales_col_tot_custom = '%.3f' % sales_col_tot
	total = [{'sales_col_tot': sales_col_tot_custom, "service_col_tot": '%.3f' % service_col_tot}]
	return sales_details, total

@frappe.whitelist()
def get_mode_of_pay_details(from_date=None, to_date=None, mode_of_pay=None, is_sale=None,is_service=None):
	mode_query = """select
				m.mode_of_payment, sum(m.amount) as amount
			from
				`tabSales Invoice` s 
			left join
				`tabMode of Pay` m
			on
				s.name = m.parent
			where
				s.docstatus = 1
		"""

	if mode_of_pay: mode_query += " and m.mode_of_payment = '{0}'".format(mode_of_pay)
	if from_date:
		from_date = datetime.datetime.strptime(from_date, '%d-%m-%Y').strftime('%Y-%m-%d')
		mode_query += " and s.posting_date >= '{0}'".format(from_date)
	
	if to_date:
		to_date = datetime.datetime.strptime(to_date, '%d-%m-%Y').strftime('%Y-%m-%d')
		mode_query += " and s.posting_date <= '{0}'".format(to_date)

	mode_query += " group by m.mode_of_payment"
	mode_of_pay_details = frappe.db.sql(mode_query,as_dict=1)
	tot_amt = 0.00
	for amt in mode_of_pay_details:
		if amt['amount']:
			tot_amt += amt['amount']
			amt['amount'] = '%.3f' % amt['amount']
	total = [{'total': '%.3f' %  tot_amt}]
	return mode_of_pay_details, total

@frappe.whitelist()
def create_csv(emp_data, mode_of_pay,filters):
	w = UnicodeWriter()
	w = add_header(w)
	w = add_data(w, emp_data, mode_of_pay, filters)
	# write out response as a type csv
	frappe.response['result'] = cstr(w.getvalue())
	frappe.response['type'] = 'csv'
	frappe.response['doctype'] = "Daily Sales Report"

def add_header(w):
	w.writerow(["Daily Sales Report"])
	return w

def add_data(w,emp_data, mode_of_pay, filters):
	emp_data = json.loads(emp_data)
	mode_of_pay = json.loads(mode_of_pay)
	filters = json.loads(filters)

	print "is sale", filters[0]['is_sale']
	w.writerow('')
	w.writerow(['', 'Employee',filters[0]['emp'],'', 'From Date',filters[0]['from_date'], '','To Date', filters[0]['to_date'],'', 'Mode of Payment', filters[0]['mode_of_pay']])
	w.writerow('\n')
	w.writerow(['Employee Sales/Service Details'])
	if emp_data[0][0]:
		if filters[0]['is_sale'] == 1 and filters[0]['is_service'] == 0:
			w.writerow(['', 'Date','','Employee', '','Total Sales'])
			for i in emp_data[0]:
				if float(i['tot_sales'])>0:
					row = ['',i['posting_date'], '', i['emp'], '', i['tot_sales']]
					w.writerow(row)
				row = ['','Total','','','', emp_data[1][0]['sales_col_tot'], '']
		elif filters[0]['is_sale'] == 0 and filters[0]['is_service'] == 1:
			w.writerow(['', 'Date','','Employee', '','Total Service'])
			for i in emp_data[0]:
				if float(i['tot_service'])>0:
					row = ['',i['posting_date'], '', i['emp'], '', i['tot_service']]
					w.writerow(row)
				row = ['','Total','','','',  emp_data[1][0]['service_col_tot']]
		else:
			w.writerow(['', 'Date','','Employee', '','Total Sales', '','Total Service'])
			for i in emp_data[0]:
				row = ['',i['posting_date'], '', i['emp'], '', i['tot_sales'], '', i['tot_service']]
				w.writerow(row)
				row = ['','Total','','','', emp_data[1][0]['sales_col_tot'], '', emp_data[1][0]['service_col_tot']]
		w.writerow('\n')
		# row = ['','Total','','','', emp_data[1][0]['sales_col_tot'], '', emp_data[1][0]['service_col_tot']]
		w.writerow(row)
	else:
		w.writerow('')
		w.writerow(['No Data Found'])
	w.writerow('\n')

	w.writerow(['Mode Of Payment Details'])
	if mode_of_pay[0]:
		w.writerow(['', 'Mode Of Payment','','Amount'])
		for i in mode_of_pay[0]:
			if i['mode_of_payment']:
				row = ['',i['mode_of_payment'], '', i['amount']]
				w.writerow(row)
		w.writerow('\n')
		w.writerow(['', 'Total','',mode_of_pay[1][0]['total']])
	else:
		w.writerow('')
		w.writerow(['No Data Found'])

	return w