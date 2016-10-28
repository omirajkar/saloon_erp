import frappe
from frappe.utils import cstr, flt, encode, nowdate, today
import datetime
import itertools



@frappe.whitelist()
def get_cash_out_data(date=None, user=None):
	query = """
				select name, DATE_FORMAT(date,'%d-%m-%Y') as date,
					user, amount, journal_entry, 
					description as invoices
				from `tabCash Out`
				where docstatus=1
			"""
	if date:
		date_ = datetime.datetime.strptime(date, '%d-%m-%Y').strftime('%Y-%m-%d')
		query += "and date = '%s'"%(date_)
	if user:
		query += "and user = '%s'"%(user)

	data = frappe.db.sql(query, as_dict=1)
	for i in data:
		i["amount"] = '%.3f' % i["amount"]
	return data

@frappe.whitelist()
def cash_out_process():
	date = today()
	cash_out_invoices = frappe.db.sql("""select description from 
					`tabCash Out` where date = '%s' and docstatus=1"""%(date))
	
	inv_list = [(e).split(",") for ele in cash_out_invoices for e in ele]
	inv_list = [encode(e) for ele in inv_list for e in ele]

	if len(inv_list) > 1:
		inv_list = tuple(inv_list)
	elif len(inv_list) == 1:
		inv_list = "("+"'"+inv_list[0]+"'"+")"

	frappe.errprint(inv_list)
	query = """select m.mode_of_payment, sum(m.amount) as amount, 
					GROUP_CONCAT(s.name SEPARATOR ',') as invoices
				from
					`tabSales Invoice` s 
				left join `tabMode of Pay` m
				on s.name = m.parent
				where s.docstatus = 1
				and m.mode_of_payment = "Cash"
				and s.posting_date = '%s' 
			"""%(date)
	query += "and s.name not in {0} group by s.posting_date".format(inv_list) if  inv_list else "group by s.posting_date"
	
	invoices_data = frappe.db.sql(query,as_dict=1)
	
	if invoices_data:
		cash_acc = frappe.db.get_value("Mode of Payment Account", {"parent": "Cash"}, "default_account")
		cash_out_acc = frappe.db.get_value("Account", {"account_name": "Cash Out"}, "name")
		
		if not cash_out_acc:
			cash_out_acc = create_cash_out_acc();
		
		jv_name = make_cash_out_jv(cash_acc, cash_out_acc, invoices_data[0]);
		make_cash_out_form(invoices_data[0], jv_name)
	else: frappe.msgprint("Nothing to Cash Out")

def create_cash_out_acc():
	args = {	
				"account_name": "Cash Out",
				"account_type": "Cash",
				"company": frappe.db.get_default("company"),
				"parent_account": frappe.db.get_value("Account", {"account_type": "Cash"}, "parent_account")
			}
	ac = frappe.new_doc("Account")
	ac.update(args)
	ac.insert()
	cash_out_acc = ac.name
	return cash_out_acc

def make_cash_out_jv(cash_acc, cash_out_acc, data):
	jv = frappe.new_doc("Journal Entry")
	jv.voucher_type = "Journal Entry"
	jv.posting_date = nowdate()
	jv.naming_series = "JV-"
	jv.multi_currency = 1
	jv.company = frappe.db.get_default("company")
	jv.user_remark = data['invoices']
	jv.set("accounts", [
		{
			"account": cash_acc,
			"credit_in_account_currency": data['amount'],
			"debit_in_account_currency": 0.000,
		},
		{
			"account": cash_out_acc,
			"debit_in_account_currency": data['amount'],
			"credit_in_account_currency": 0.000
		},
	])
	jv.flags.ignore_permissions = 1
	jv.insert()
	jv.submit()
	return jv.name


def make_cash_out_form(invoices_data, jv):
	co = frappe.new_doc("Cash Out")
	co.journal_entry = jv
	co.description = invoices_data['invoices']
	co.amount = invoices_data['amount']
	co.date = nowdate()
	co.user = frappe.session.user
	co.insert();
	co.submit();

