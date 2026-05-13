from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class ManualInputCreate(BaseModel):
    fecha: date
    cm_ton: Optional[float] = None
    aco_mt: Optional[float] = None
    cc_ton: Optional[float] = None
    co_ton: Optional[float] = None
    viento_norte_nudos: Optional[str] = None
    viento_sur_nudos: Optional[str] = None
    corriente_playa_carmen_nudos: Optional[float] = None
    corriente_cancun_nudos: Optional[float] = None
    semaforo: Optional[str] = None
    conglomerado_cozumel: Optional[str] = None
    notas: Optional[str] = None


class ManualInputResponse(ManualInputCreate):
    id: int
    created_at: str
    processed: bool

    class Config:
        from_attributes = True


class PipelineStatus(BaseModel):
    status: str
    message: str
    last_run: Optional[str] = None
    steps: Optional[dict] = None
