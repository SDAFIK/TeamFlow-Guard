import json
import pytest
import httpx
from app import ai

@pytest.mark.parametrize('change', ['evidence','index','duplicate','schema','incomplete','timeout','valid'])
def test_provider_validation(monkeypatch, change):
    monkeypatch.setenv('OPENAI_API_KEY','test-only')
    monkeypatch.setenv('OPENAI_MODEL','test-model')
    candidate={'title':'Review plan','explanation':'Review the observed evidence before applying changes.','action_indices':[0],'evidence_ids':['known'],'assumptions':[]}
    if change=='evidence': candidate['evidence_ids']=['invented']
    if change=='index': candidate['action_indices']=[8]
    if change=='duplicate': candidate['action_indices']=[0,0]
    if change=='schema': candidate['execute']=True
    class FakeClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def post(self,url,**kwargs):
            assert kwargs['json']['store'] is False
            assert kwargs['json']['text']['format']['strict'] is True
            if change=='timeout': raise httpx.ReadTimeout('test timeout')
            return httpx.Response(200,json={'status':'incomplete' if change=='incomplete' else 'completed','output':[{'content':[{'type':'output_text','text':json.dumps(candidate)}]}]})
    monkeypatch.setattr(ai.httpx,'Client',FakeClient)
    context={'evidence':[{'id':'known'}],'candidates':[{'field':'priority'}]}
    if change=='valid': assert ai.analyze(context)[0].evidence_ids==['known']
    else:
        with pytest.raises(ai.ProviderFailure): ai.analyze(context)
