"""Commercial lifecycle over HTTP and PostgreSQL, with a controlled clock."""
from datetime import timedelta
from decimal import Decimal
import pytest
from sqlalchemy import select
from app.models import Pairing, User, VestingEntry, LedgerRevision, Application
from app.services import commercial, pairings
from app.routers import commercial as routes
from app.domain.contracts import monthly_fee, vested_units
from tests.conftest import APPLICATION, NOW, THIS_MONDAY, COMMERCIAL_TERMS, as_

@pytest.fixture
def offer(client, db, world):
    a=client.post('/ventures/test/applications',json=APPLICATION,headers=as_('usr_cp'))
    assert a.status_code==201,a.text
    r=client.post(f'/applications/{a.json()["id"]}/review',json={'action':'invite'},headers=as_('usr_builder'))
    assert r.status_code==200,r.text
    return db.scalar(select(Pairing))

def act(client,p,action,who='usr_cp',**extra):
    return client.post(f'/pairings/{p.id}/agreement',json={'action':action,'agreement_hash':p.agreement['hash'],**extra},headers=as_(who))

@pytest.fixture
def accepted(client,offer):
    assert act(client,offer,'accept').status_code==200
    return offer

def clock(monkeypatch,at):
    monkeypatch.setattr(commercial,'now_utc',lambda:at)
    monkeypatch.setattr(routes,'now_utc',lambda:at)

def test_offer_does_not_start_work_or_grant_equity(client,db,offer):
    assert offer.state=='offered' and offer.accepted_at is None
    r=client.post(f'/pairings/{offer.id}/ledger',json={'week_starting':THIS_MONDAY.isoformat(),'values':{'merchants_live':3,'revenue_php':10000}},headers=as_('usr_cp'))
    assert r.status_code==400
    for _ in range(2):
        assert client.get('/workspace',headers=as_('usr_cp')).status_code==200
        assert client.get(f'/pairings/{offer.id}',headers=as_('usr_cp')).status_code==200
    assert offer.state=='offered' and db.scalar(select(VestingEntry)) is None

def test_acceptance_requires_invitee_verified_email_and_exact_version(client,db,offer):
    assert act(client,offer,'accept','usr_builder').status_code==400
    assert act(client,offer,'accept','usr_cp2').status_code==403
    assert act(client,offer,'accept',agreement_hash='wrong').status_code==400
    user=db.get(User,'usr_cp');user.email_verified_at=None;db.commit()
    assert act(client,offer,'accept').status_code==400
    user.email_verified_at=NOW;db.commit()
    assert act(client,offer,'accept').status_code==200
    assert offer.started_at==NOW and offer.accepted_at==NOW
    assert act(client,offer,'accept').status_code==400

def test_declined_offer_can_be_reissued(client,db,offer):
    assert act(client,offer,'decline').status_code==200
    assert db.get(Application,offer.application_id).status=='shortlisted'
    assert client.post(f'/applications/{offer.application_id}/review',json={'action':'invite'},headers=as_('usr_builder')).status_code==200
    assert len(list(db.scalars(select(Pairing))))==2

def test_offer_expires_and_releases_reservation(db,offer):
    pairings.sync(db,offer,NOW+timedelta(days=14))
    assert offer.state=='declined'
    assert db.get(Application,offer.application_id).status=='shortlisted'

def test_saved_terms_and_goals_do_not_follow_venture_edits(client,db,world,accepted):
    v=world['venture'];original=accepted.agreement['terms'].copy()
    v.commercial_terms={**v.commercial_terms,'monthly_fee_php':'999999.00'}
    v.milestones[0].target_value=999;db.commit()
    assert accepted.agreement['terms']==original
    d=client.get(f'/pairings/{accepted.id}',headers=as_('usr_cp')).json()
    assert d['milestones'][0]['milestone']['target_value']==3

def test_reports_never_award_equity_or_automatically_convert(client,db,accepted,monkeypatch):
    from app.services import ledger
    monkeypatch.setattr(ledger,'now_utc',lambda:NOW+timedelta(hours=1))
    body={'week_starting':THIS_MONDAY.isoformat(),'values':{'merchants_live':300,'revenue_php':999999},'note':'Initial report','evidence_links':['https://example.com/evidence']}
    r=client.post(f'/pairings/{accepted.id}/ledger',json=body,headers=as_('usr_cp'));assert r.status_code==200,r.text
    body['values']['revenue_php']=100
    r=client.post(f'/pairings/{accepted.id}/ledger',json=body,headers=as_('usr_cp'));assert r.status_code==200,r.text
    assert accepted.state=='proving_run' and db.scalar(select(VestingEntry)) is None
    history=list(db.scalars(select(LedgerRevision).order_by(LedgerRevision.created_at)))
    assert [r.snapshot['values']['revenue_php'] for r in history]==[999999,100]
    assert act(client,accepted,'continue').status_code==400
    assert act(client,accepted,'request_continuation','usr_builder').status_code==200
    assert act(client,accepted,'continue').status_code==200
    assert accepted.state=='active'

def test_trial_expires_at_exact_boundary_and_preserves_snapshot(db,accepted):
    snapshot=accepted.agreement.copy()
    pairings.sync(db,accepted,NOW+timedelta(days=45)-timedelta(seconds=1));assert accepted.state=='proving_run'
    pairings.sync(db,accepted,NOW+timedelta(days=45));assert accepted.state=='released'
    assert accepted.ended_at==NOW+timedelta(days=45) and accepted.agreement==snapshot

@pytest.fixture
def deal(client,accepted):
    r=client.post(f'/pairings/{accepted.id}/deals',json={'reference':'customer-001','evidence':'Signed introduction and customer correspondence'},headers=as_('usr_cp'))
    assert r.status_code==201,r.text
    return r.json()

def claim(client,p,deal,at=NOW,**over):
    body={'kind':'commission','reference':'receipt-001','deal_id':deal['id'],'collected_at':at.isoformat(),'eligible_revenue_php':'1000.05','evidence':'Bank receipt and invoice for the customer',**over}
    return client.post(f'/pairings/{p.id}/claims',json=body,headers=as_('usr_cp'))

def test_decimal_commission_requires_both_payment_parties(client,accepted,deal):
    r=claim(client,accepted,deal);assert r.status_code==201,r.text
    assert Decimal(r.json()['amount_php'])==Decimal('100.01')
    assert claim(client,accepted,deal).status_code==400
    url=f'/claims/{r.json()["id"]}/action'
    def action(who,name):return client.post(url,json={'action':name,'note':'Bank transaction reference 12345'},headers=as_(who))
    assert action('usr_cp','confirm').status_code==400
    assert action('usr_builder','confirm').json()['status']=='confirmed'
    assert action('usr_cp','acknowledge_payment').status_code==400
    assert action('usr_builder','report_payment').json()['status']=='payment_reported'
    assert action('usr_cp','acknowledge_payment').json()['status']=='paid'
    assert action('usr_cp','acknowledge_payment').status_code==400
    data=client.get(f'/pairings/{accepted.id}/commercial',headers=as_('usr_cp')).json()
    assert len(data['claims'][0]['events'])==4

def test_exit_stops_registration_but_preserves_finite_pipeline(client,db,accepted,deal,monkeypatch):
    exit_at=NOW+timedelta(days=1)
    pairings.end(db,db.get(User,'usr_builder'),accepted,'End work',exit_at)
    clock(monkeypatch,exit_at+timedelta(days=90))
    assert claim(client,accepted,deal,exit_at+timedelta(days=90)).status_code==201
    clock(monkeypatch,exit_at+timedelta(days=90,seconds=1))
    assert claim(client,accepted,deal,exit_at+timedelta(days=90,seconds=1),reference='receipt-002').status_code==400
    assert client.post(f'/pairings/{accepted.id}/deals',json={'reference':'late-deal','evidence':'Registration after departure'},headers=as_('usr_cp')).status_code==400

def test_prorated_fee_and_duplicate_month(client,db,accepted,monkeypatch):
    end=NOW+timedelta(days=1)
    pairings.end(db,db.get(User,'usr_cp'),accepted,'End',end);clock(monkeypatch,end)
    body={'kind':'fee','reference':'September','fee_month':'2026-09','evidence':'Service through departure'}
    r=client.post(f'/pairings/{accepted.id}/claims',json=body,headers=as_('usr_cp'))
    assert r.status_code==201,r.text
    assert Decimal(r.json()['amount_php'])==Decimal('1000.00')
    assert client.post(f'/pairings/{accepted.id}/claims',json={**body,'reference':'Another reference'},headers=as_('usr_cp')).status_code==400
    assert monthly_fee(COMMERCIAL_TERMS,NOW,end,2026,8)==0

def test_dispute_creates_case_and_only_admin_records_resolution(client,accepted,deal):
    c=claim(client,accepted,deal).json()
    r=client.post(f'/claims/{c["id"]}/action',json={'action':'dispute','note':'Receipt appears to include a refund'},headers=as_('usr_builder'));assert r.status_code==200
    cases=client.get(f'/pairings/{accepted.id}/commercial',headers=as_('usr_cp')).json()['cases'];assert len(cases)==1
    url=f'/review-cases/{cases[0]["id"]}/resolve';body={'action':'resolve','note':'Both parties reviewed the bank receipt and agreed the recorded amount.'}
    assert client.post(url,json=body,headers=as_('usr_builder')).status_code==403
    assert client.post(url,json=body,headers=as_('usr_admin')).json()['status']=='resolved'

def test_investors_cannot_read_commercial_evidence(client,accepted):
    assert client.get(f'/pairings/{accepted.id}/commercial',headers=as_('usr_kaye')).status_code==403
    assert client.get('/workspace',headers=as_('usr_kaye')).json()['pairings']==[]

def grant_body():
    return dict(entity='Test Venture Corporation',share_class='Ordinary',grant_units=10000,capitalization_units=100000,vesting_start=NOW.isoformat(),vesting_months=48,cliff_months=12,signed_document_url='https://example.com/signed-grant.pdf',approval_reference='Board resolution and shareholder approval 2026-01',departure_terms='Unvested units lapse at departure; vested units follow the signed instrument and lawful buyback provisions.',confirms_authority_and_review=True)

def test_cofounder_requires_full_trial_separate_acceptance_and_cliff(client,db,accepted,monkeypatch):
    assert act(client,accepted,'request_continuation','usr_builder').status_code==200
    assert act(client,accepted,'continue').status_code==200
    url=f'/pairings/{accepted.id}/grants'
    assert client.post(url,json=grant_body(),headers=as_('usr_builder')).status_code==400
    clock(monkeypatch,NOW+timedelta(days=46))
    r=client.post(url,json=grant_body(),headers=as_('usr_builder'));assert r.status_code==201,r.text
    grant=r.json();assert accepted.state=='active'
    action=f'/grants/{grant["id"]}/action'
    assert client.post(action,json={'action':'accept','agreement_hash':'wrong'},headers=as_('usr_cp')).status_code==400
    assert client.post(action,json={'action':'accept','agreement_hash':grant['terms']['hash']},headers=as_('usr_cp')).status_code==200
    assert accepted.state=='cofounder'
    assert vested_units(grant['terms'],NOW.replace(year=2027)-timedelta(seconds=1))==0
    assert vested_units(grant['terms'],NOW.replace(year=2027))==2500
    pairings.sync(db,accepted,NOW.replace(year=2031));assert accepted.state=='cofounder'
    pairings.end(db,db.get(User,'usr_cp'),accepted,'Move on',NOW.replace(year=2027))
    clock(monkeypatch,NOW.replace(year=2030))
    details=client.get(f'/pairings/{accepted.id}/commercial',headers=as_('usr_cp')).json()
    assert details['grants'][0]['vested_units']==2500

def test_grant_rejects_overallocation(client,accepted,monkeypatch):
    act(client,accepted,'request_continuation','usr_builder');act(client,accepted,'continue')
    clock(monkeypatch,NOW+timedelta(days=46))
    assert client.post(f'/pairings/{accepted.id}/grants',json={**grant_body(),'grant_units':40001},headers=as_('usr_builder')).status_code==400
