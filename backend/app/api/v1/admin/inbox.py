from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession
from app.core.enums import InquiryStatus
from app.schemas.common import Message, Page, PageParams
from app.schemas.system import ContactOut, ContactUpdate, InquiryOut, InquiryStatusUpdate
from app.services.inbox_service import ContactService, InquiryService

router = APIRouter()


@router.get("/inquiries", response_model=Page[InquiryOut], tags=["admin: inquiries"])
def list_inquiries(
    db: DbSession, params: Annotated[PageParams, Depends()],
    status: InquiryStatus | None = None, q: str | None = Query(None, max_length=100),
) -> Page[InquiryOut]:
    items, total = InquiryService(db).list(params, status, q)
    return Page[InquiryOut].build([InquiryOut.model_validate(i) for i in items], total, params)


@router.get("/inquiries/{inquiry_id}", response_model=InquiryOut, tags=["admin: inquiries"])
def get_inquiry(inquiry_id: int, db: DbSession) -> InquiryOut:
    return InquiryOut.model_validate(InquiryService(db).get(inquiry_id))


@router.patch("/inquiries/{inquiry_id}", response_model=InquiryOut, tags=["admin: inquiries"])
def update_inquiry(inquiry_id: int, body: InquiryStatusUpdate, db: DbSession) -> InquiryOut:
    return InquiryOut.model_validate(InquiryService(db).set_status(inquiry_id, body.status))


@router.delete("/inquiries/{inquiry_id}", response_model=Message, tags=["admin: inquiries"])
def delete_inquiry(inquiry_id: int, db: DbSession) -> Message:
    InquiryService(db).delete(inquiry_id)
    return Message(detail="Inquiry deleted")


@router.get("/contact-messages", response_model=Page[ContactOut], tags=["admin: contact"])
def list_messages(
    db: DbSession, params: Annotated[PageParams, Depends()],
    is_read: bool | None = None, q: str | None = Query(None, max_length=100),
) -> Page[ContactOut]:
    items, total = ContactService(db).list(params, is_read, q)
    return Page[ContactOut].build([ContactOut.model_validate(i) for i in items], total, params)


@router.get("/contact-messages/{message_id}", response_model=ContactOut, tags=["admin: contact"])
def get_message(message_id: int, db: DbSession) -> ContactOut:
    return ContactOut.model_validate(ContactService(db).get(message_id))


@router.patch("/contact-messages/{message_id}", response_model=ContactOut, tags=["admin: contact"])
def mark_message(message_id: int, body: ContactUpdate, db: DbSession) -> ContactOut:
    return ContactOut.model_validate(ContactService(db).mark(message_id, body.is_read))


@router.delete("/contact-messages/{message_id}", response_model=Message, tags=["admin: contact"])
def delete_message(message_id: int, db: DbSession) -> Message:
    ContactService(db).delete(message_id)
    return Message(detail="Message deleted")
