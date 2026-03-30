from django.db.models import QuerySet
from apps.identity.models import User


class UserRepository:

    @staticmethod
    def get_all() -> QuerySet:
        return User.objects.all().order_by("employee_id")

    @staticmethod
    def get_by_id(user_id: int) -> User | None:
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    def get_by_employee_id(employee_id: str) -> User | None:
        try:
            return User.objects.get(employee_id=employee_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    def filter(
        role: str | None = None,
        plant: str | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> QuerySet:
        qs = User.objects.all()

        if role:
            qs = qs.filter(role=role)
        if plant:
            qs = qs.filter(plant__icontains=plant)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        if search:
            qs = qs.filter(
                employee_id__icontains=search
            ) | qs.filter(
                first_name__icontains=search
            ) | qs.filter(
                last_name__icontains=search
            )

        return qs.order_by("employee_id")

    @staticmethod
    def create(validated_data: dict) -> User:
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def update(user: User, validated_data: dict) -> User:
        for field, value in validated_data.items():
            setattr(user, field, value)
        user.save()
        return user

    @staticmethod
    def toggle_active(user: User) -> User:
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return user

    @staticmethod
    def reset_password(user: User, new_password: str) -> User:
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return user