from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    UUID,
    Boolean,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    wallets: Mapped[list["UserWallet"]] = relationship(back_populates="user")
    exchange_accounts: Mapped[list["ExchangeAccount"]] = relationship(
        back_populates="user"
    )


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (UniqueConstraint("address", "chain", name="uq_wallet_chain"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    address: Mapped[str] = mapped_column(String(128), nullable=False)
    chain: Mapped[str] = mapped_column(String(50), nullable=False, default="ethereum")
    wallet_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="self_custody"
    )
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    users: Mapped[list["UserWallet"]] = relationship(back_populates="wallet")


class UserWallet(Base):
    __tablename__ = "user_wallets"
    __table_args__ = (UniqueConstraint("user_id", "wallet_id", name="uq_user_wallet"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    wallet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wallets.id"), nullable=False)
    nickname: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    connected_via: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="wallets")
    wallet: Mapped["Wallet"] = relationship(back_populates="users")


class ExchangeAccount(Base):
    __tablename__ = "exchange_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    exchange_name: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    external_account_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    api_key_hint: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    api_key_encrypted: Mapped[Optional[bytes]] = mapped_column(
        LargeBinary, nullable=True
    )
    api_secret_encrypted: Mapped[Optional[bytes]] = mapped_column(
        LargeBinary, nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="exchange_accounts")


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    total_value_usd: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )


class AiReport(Base):
    __tablename__ = "ai_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
