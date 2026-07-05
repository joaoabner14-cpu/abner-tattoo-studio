<?php

$host = "localhost";
$user = "root";
$password = "";
$database = "abnertattoostudio";

$conn = new mysqli(
    $host,
    $user,
    $password,
    $database
);

if ($conn->connect_error) {
    die("Erro: " . $conn->connect_error);
}

$conn->set_charset("utf8");