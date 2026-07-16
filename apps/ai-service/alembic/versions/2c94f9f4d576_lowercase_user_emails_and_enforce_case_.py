"""lowercase user emails and enforce case-insensitive uniqueness

Revision ID: 2c94f9f4d576
Revises: d1574d4bd57e
Create Date: 2026-07-16 14:45:11.883782

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c94f9f4d576'
down_revision: Union[str, None] = 'd1574d4bd57e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    collisions = conn.execute(
        sa.text(
            "SELECT count(*) FROM ("
            "  SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1"
            ") d"
        )
    ).scalar_one()
    if collisions:
        raise RuntimeError(
            f"{collisions} email address(es) exist under more than one case. "
            "Merge those accounts by hand before running this migration."
        )

    op.execute("UPDATE users SET email = lower(email) WHERE email <> lower(email)")
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_email_lower", table_name="users")
