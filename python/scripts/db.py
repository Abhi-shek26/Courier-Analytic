"""Shared MSSQL connection for Courier-Analytic python layer."""
import pandas as pd
import pyodbc

CS = ("DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;"
      "DATABASE=CourierAnalytic;Trusted_Connection=yes;TrustServerCertificate=yes;")


def query(sql, params=()):
    with pyodbc.connect(CS) as conn:
        return pd.read_sql(sql, conn, params=params)
