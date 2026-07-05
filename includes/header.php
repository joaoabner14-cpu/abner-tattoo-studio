<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">

<meta
name="theme-color"
content="#191919">

<meta
name="apple-mobile-web-app-capable"
content="yes">

<meta
name="apple-mobile-web-app-status-bar-style"
content="black-translucent">

<meta
name="viewport"
content="width=device-width,
initial-scale=1,
viewport-fit=cover">

<title>Abner Tattoo Studio</title>

<link
rel="icon"
type="image/x-icon"
href="assets/img/logo.ico">

<link
href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
rel="stylesheet">

<link
href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.css"
rel="stylesheet">

<link
href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
rel="stylesheet">

<link href="assets/css/estilo.css" rel="stylesheet">

<style>

a,
a:visited{

    color:#FFFFFF;

    text-decoration:none;

}

a:hover{

    color:#CCCCCC;

}

/*
==================================================
CLIENTES
==================================================
*/

#painelCliente{

    min-height: calc(100vh - 120px);

}

#painelCliente .card{

    min-height: 100%;

}

#painelCliente .tab-content, #painelSelecioneCliente{

    min-height: calc(100vh);

    overflow-y: auto;

    scrollbar-width: none;

}

#listaClientes{

    min-height: calc(100vh - 200px);

    overflow-y: auto;

    scrollbar-width: none;

}

</style>

</head>

<body>
<?php include 'includes/menu.php'; ?>