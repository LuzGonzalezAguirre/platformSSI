from apps.identity.models import User
from apps.identity.repositories import UserRepository


class ProfileService:

    @staticmethod
    def update_profile(user: User, validated_data: dict) -> User:
        protected_fields = {"employee_id", "password", "role", "is_active", "is_superuser"}
        clean_data = {
            k: v for k, v in validated_data.items()
            if k not in protected_fields
        }
        return UserRepository.update(user, clean_data)

    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> User:
        if not user.check_password(current_password):
            raise ValueError("La contraseña actual es incorrecta.")
        return UserRepository.reset_password(user, new_password)