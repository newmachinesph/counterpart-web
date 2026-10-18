import re
from datetime import timedelta
from sqlalchemy import select
from app.accounts import token_hash
from app.models import AccountToken, OutboxEmail
from app.services.common import now_utc
from tests.test_accounts_workspace import ACCOUNT

def token(db, fragment):
    emails=list(db.scalars(select(OutboxEmail)))
    message=next(e for e in reversed(emails) if fragment in e.body)
    return re.search(r'token=([A-Za-z0-9_-]+)',message.body).group(1)

def test_terms_consent_is_required(client):
    assert client.post('/auth/register',json={**ACCOUNT,'accept_platform_terms':False}).status_code==422

def test_verification_token_is_hashed_single_use_and_purpose_bound(client,db):
    r=client.post('/auth/register',json=ACCOUNT);assert r.status_code==201
    raw=token(db,'/account/verify');assert db.get(AccountToken,raw) is None
    assert db.get(AccountToken,token_hash(raw)).purpose=='verify'
    assert client.post('/auth/reset-password',json={'token':raw,'password':'replacement-passphrase'}).status_code==400
    assert client.post('/auth/verify-email',json={'token':raw}).status_code==200
    assert client.post('/auth/verify-email',json={'token':raw}).status_code==400

def test_recovery_revokes_existing_sessions_and_all_reset_links(client,db):
    session=client.post('/auth/register',json=ACCOUNT).json()['token']
    assert client.post('/auth/forgot-password',json={'email':ACCOUNT['email']}).json()==client.post('/auth/forgot-password',json={'email':'missing@example.test'}).json()
    raw=token(db,'/account/reset')
    assert client.post('/auth/reset-password',json={'token':raw,'password':'replacement-passphrase'}).status_code==200
    assert client.get('/me',headers={'Authorization':f'Bearer {session}'}).status_code==401
    assert client.post('/auth/login',json=ACCOUNT).status_code==401
    assert client.post('/auth/login',json={**ACCOUNT,'password':'replacement-passphrase'}).status_code==200
    assert client.post('/auth/reset-password',json={'token':raw,'password':'another-passphrase'}).status_code==400

def test_expired_recovery_link_cannot_change_password(client,db):
    client.post('/auth/register',json=ACCOUNT)
    client.post('/auth/forgot-password',json={'email':ACCOUNT['email']})
    raw=token(db,'/account/reset');db.get(AccountToken,token_hash(raw)).expires_at=now_utc()-timedelta(seconds=1);db.commit()
    assert client.post('/auth/reset-password',json={'token':raw,'password':'replacement-passphrase'}).status_code==400
    assert client.post('/auth/login',json=ACCOUNT).status_code==200
