"""Public preview: static web, read-only tournament and fan messages only."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from backend.database import ROOT
from backend.fans import router, fans_engine
from scripts.export_data import dataset

app=FastAPI(title='Olimpiadas NSP · Vista pública',docs_url=None,redoc_url=None,openapi_url=None)
app.include_router(router)

@app.get('/api/tournament')
def tournament():
    data=dataset(fans_engine());data['capabilities']={'result_write':False}
    return data

app.mount('/',StaticFiles(directory=ROOT/'dist',html=True),name='web')
