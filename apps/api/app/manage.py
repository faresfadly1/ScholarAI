"""Operator-only account role management. Not exposed as an HTTP endpoint."""

import argparse

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import AuditLog, User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["promote-admin"])
    parser.add_argument("email")
    args = parser.parse_args()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email.lower()))
        if not user:
            raise SystemExit("Account not found. Register the account first.")
        user.role = "admin"
        db.add(AuditLog(user_id=user.id, action="operator.admin_promoted", resource_id=user.id))
        db.commit()
        print("Administrator role assigned.")


if __name__ == "__main__":
    main()
