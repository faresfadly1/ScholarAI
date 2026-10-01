from app.core.config import Settings


def test_render_postgres_urls_use_installed_psycopg_driver():
    assert (
        Settings(database_url="postgres://student:secret@db.example/scholarai").database_url
        == "postgresql+psycopg://student:secret@db.example/scholarai"
    )
    assert (
        Settings(database_url="postgresql://student:secret@db.example/scholarai").database_url
        == "postgresql+psycopg://student:secret@db.example/scholarai"
    )


def test_other_database_urls_are_unchanged():
    assert (
        Settings(database_url="sqlite:///./.data/test.db").database_url
        == "sqlite:///./.data/test.db"
    )
