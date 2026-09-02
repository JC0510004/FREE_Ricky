from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class PasswordResetThrottle(AnonRateThrottle):
    scope = 'password_reset'


class ChangePasswordThrottle(UserRateThrottle):
    scope = 'change_password'
