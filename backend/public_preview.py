"""Public web with authenticated, team-scoped result registration."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from backend.database import ROOT
from backend.fans import router

app=FastAPI(title='Olimpiadas NSP · Vista pública',docs_url=None,redoc_url=None,openapi_url=None)
app.include_router(router)
from backend.auth import router as auth_router, tournament_for
from fastapi import Request, Response
app.include_router(auth_router)
from backend.analytics import router as analytics_router
app.include_router(analytics_router)
@app.middleware('http')
async def no_cache_sessions(request,call_next):
    response=await call_next(request)
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control']='no-store'
    return response

@app.get('/api/tournament')
def tournament(request:Request,response:Response):
    response.headers['Cache-Control']='no-store'
    return tournament_for(request)

app.mount('/',StaticFiles(directory=ROOT/'dist',html=True),name='web')
