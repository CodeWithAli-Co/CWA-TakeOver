// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dotenv::dotenv;
use openssl::ssl::{SslConnector, SslMethod};
use postgres::Client;
use postgres_openssl::MakeTlsConnector;
use std::env;
use std::error;

fn main() -> Result<(), Box<dyn error::Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    // Get the connection string from the environment variable
    let conn_str = env::var("DATABASE_URL")?;
    let builder = SslConnector::builder(SslMethod::tls())?;
    let connector = MakeTlsConnector::new(builder.build());
    let mut client = Client::connect(&conn_str, connector)?;
    for row in client.query("select version()", &[])? {
        let ret: String = row.get(0);
        println!("Result = {}", ret);
    }
    cwa_manager_lib::run();

    Ok(())
}
