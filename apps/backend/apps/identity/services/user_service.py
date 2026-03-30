from apps.identity.models import User
from apps.identity.repositories import UserRepository


class UserService:

    @staticmethod
    def list_users(
        role: str | None = None,
        plant: str | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ):
        return UserRepository.filter(
            role=role,
            plant=plant,
            is_active=is_active,
            search=search,
        )

    @staticmethod
    def get_user(user_id: int) -> User:
        user = UserRepository.get_by_id(user_id)
        if user is None:
            raise ValueError(f"Usuario {user_id} no encontrado.")
        return user

    @staticmethod
    def create_user(validated_data: dict) -> User:
        employee_id = validated_data.get("employee_id")
        if UserRepository.get_by_employee_id(employee_id):
            raise ValueError(f"El número de empleado {employee_id} ya existe.")
        return UserRepository.create(validated_data)

    @staticmethod
    def update_user(user_id: int, validated_data: dict) -> User:
        user = UserService.get_user(user_id)
        protected_fields = {"employee_id", "password", "is_superuser"}
        clean_data = {k: v for k, v in validated_data.items() if k not in protected_fields}
        return UserRepository.update(user, clean_data)

    @staticmethod
    def toggle_active(user_id: int, requesting_user: User) -> User:
        user = UserService.get_user(user_id)
        if user.id == requesting_user.id:
            raise ValueError("No puedes desactivar tu propia cuenta.")
        return UserRepository.toggle_active(user)

    @staticmethod
    def reset_password(user_id: int, new_password: str) -> User:
        if len(new_password) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        user = UserService.get_user(user_id)
        return UserRepository.reset_password(user, new_password)