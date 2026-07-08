"""Declarative base shared by every ORM model.

These models exist only as Alembic's autogenerate source (see
docs/architecture/project-structure-and-conventions.md §4) — runtime queries
go through app/db/repositories/ with raw asyncpg.

The naming_convention matters: it makes constraint/index names deterministic,
so Alembic diffs stay stable across machines instead of generating spurious
rename operations.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
