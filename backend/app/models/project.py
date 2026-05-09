"""Modelos ORM SQLAlchemy para projetos de malha de aterramento."""

import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, Boolean, JSON, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projects: Mapped[list["Project"]] = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    client: Mapped[str] = mapped_column(String(255), nullable=True)
    location: Mapped[str] = mapped_column(String(255), nullable=True)
    project_type: Mapped[str] = mapped_column(String(50), default="substation")  # substation, spda, industrial, etc.
    standard: Mapped[str] = mapped_column(String(50), default="IEEE80")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    owner: Mapped[User] = relationship("User", back_populates="projects")
    scenarios: Mapped[list["Scenario"]] = relationship("Scenario", back_populates="project", cascade="all, delete-orphan")


class Scenario(Base):
    """Um cenário dentro de um projeto (permite comparar diferentes configurações)."""
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Dados do solo (JSON)
    soil_data: Mapped[dict] = mapped_column(JSON, default=dict)

    # Geometria da malha (JSON)
    mesh_data: Mapped[dict] = mapped_column(JSON, default=dict)

    # Condições de falta (JSON)
    fault_data: Mapped[dict] = mapped_column(JSON, default=dict)

    # Resultados calculados (JSON — cache)
    results: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped[Project] = relationship("Project", back_populates="scenarios")
