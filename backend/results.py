"""Validación de resultados y reglas; sin suponer un reglamento oficial."""
from typing import Annotated, Literal
from pydantic import BaseModel, Field, ConfigDict
Number = Annotated[int, Field(strict=True, ge=0, le=10000)]
class SetScore(BaseModel):
    model_config=ConfigDict(extra='forbid')
    home:Number
    away:Number
class ResultInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    home_score:Number
    away_score:Number
    home_points:Number=0
    away_points:Number=0
    home_yellow:Number=0
    away_yellow:Number=0
    home_red:Number=0
    away_red:Number=0
    walkover:Literal['none','home','away','both']='none'
    sets:list[SetScore]=Field(default_factory=list,max_length=5)
class RuleInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    win:Number
    draw:Number
    loss:Number
    allow_draw:bool
    wo_win:Number
    wo_loss:Number
    wo_score_for:Number|None=None
    wo_score_against:Number=0
    wo_set_points:Number=25
    tiebreakers:list[Literal['points','wins','difference','for']]=Field(min_length=1,max_length=4)

def normalize_result(match, payload, rule):
    result=ResultInput.model_validate(payload).model_dump()
    if match.kind!='OFICIAL' or not match.home_id or not match.away_id:
        raise ValueError('El partido debe tener ambos equipos definidos y no ser reserva.')
    volleyball=match.sport.startswith('voley')
    wo=result['walkover']
    if wo=='both':
        result.update(home_score=0,away_score=0,home_points=0,away_points=0,sets=[])
    elif wo!='none' and rule.get('wo_score_for') is not None:
        for_score=rule['wo_score_for'];against=rule.get('wo_score_against',0);home_wins=wo=='away'
        result['home_score']=for_score if home_wins else against;result['away_score']=against if home_wins else for_score
        points=rule.get('wo_set_points',25) if volleyball else 1
        result['home_points']=result['home_score']*points;result['away_points']=result['away_score']*points
        result['sets']=[{'home':points if (i<for_score)==home_wins else 0,'away':0 if (i<for_score)==home_wins else points} for i in range(for_score+against)] if volleyball else []
    elif result['walkover']=='none' and volleyball:
        if not result['sets']:raise ValueError('Indica los puntos de cada set de vóley.')
        if any(s['home']==s['away'] for s in result['sets']):raise ValueError('Un set no puede quedar empatado.')
        result['home_score']=sum(s['home']>s['away'] for s in result['sets'])
        result['away_score']=sum(s['away']>s['home'] for s in result['sets'])
        result['home_points']=sum(s['home'] for s in result['sets'])
        result['away_points']=sum(s['away'] for s in result['sets'])
    elif not volleyball:
        if result['sets']:raise ValueError('Los sets solo corresponden a vóley.')
        result['home_points']=result['home_score'];result['away_points']=result['away_score']
    elif result['sets']:
        raise ValueError('El walkover usa marcador administrativo, sin sets jugados.')
    home=result['home_score'];away=result['away_score'];wo=result['walkover']
    if wo=='home' and home>=away:raise ValueError('Si falta el local, el visitante debe tener el marcador ganador.')
    if wo=='away' and away>=home:raise ValueError('Si falta el visitante, el local debe tener el marcador ganador.')
    if wo=='both' and (home or away or result['home_points'] or result['away_points']):raise ValueError('La doble inasistencia debe tener marcador 0–0.')
    knockout='FINAL' in match.phase
    if knockout and wo=='both':raise ValueError('Una fase eliminatoria necesita un ganador.')
    if wo=='none' and home==away and (not rule['allow_draw'] or knockout or volleyball):
        raise ValueError('Este partido requiere un ganador.')
    return result
