<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

session_start();

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        // Listar productos
        $search = $_GET['search'] ?? '';
        
        if ($search) {
            $query = "SELECT * FROM products WHERE name LIKE :search OR sku LIKE :search OR category LIKE :search ORDER BY created_at DESC";
            $stmt = $db->prepare($query);
            $searchParam = "%$search%";
            $stmt->bindParam(':search', $searchParam);
        } else {
            $query = "SELECT * FROM products ORDER BY created_at DESC";
            $stmt = $db->prepare($query);
        }
        
        $stmt->execute();
        $products = $stmt->fetchAll();
        
        // Decodificar JSON de imeis
        foreach ($products as &$product) {
            $product['imeis'] = json_decode($product['imeis'], true) ?? [];
        }
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $products]);
        break;
        
    case 'POST':
        // Crear producto
        $data = $input;
        
        $query = "INSERT INTO products (name, sku, category, stock, sell_price, cost_price, avg_cost_price, image, description, imeis, created_by) 
                  VALUES (:name, :sku, :category, :stock, :sell_price, :cost_price, :avg_cost_price, :image, :description, :imeis, :created_by)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':sku', $data['sku']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':stock', $data['stock']);
        $stmt->bindParam(':sell_price', $data['sellPrice']);
        $stmt->bindParam(':cost_price', $data['costPrice']);
        $stmt->bindParam(':avg_cost_price', $data['avgCostPrice']);
        $stmt->bindParam(':image', $data['image']);
        $stmt->bindParam(':description', $data['description']);
        $imeis_json = json_encode($data['imeis'] ?? []);
        $stmt->bindParam(':imeis', $imeis_json);
        $stmt->bindParam(':created_by', $_SESSION['user_email']);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $db->lastInsertId(), 'message' => 'Producto creado']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al crear producto']);
        }
        break;
        
    case 'PUT':
        // Actualizar producto
        $id = $_GET['id'] ?? null;
        $data = $input;
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit();
        }
        
        $query = "UPDATE products SET name = :name, sku = :sku, category = :category, stock = :stock, 
                  sell_price = :sell_price, cost_price = :cost_price, avg_cost_price = :avg_cost_price, 
                  image = :image, description = :description, imeis = :imeis WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':sku', $data['sku']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':stock', $data['stock']);
        $stmt->bindParam(':sell_price', $data['sellPrice']);
        $stmt->bindParam(':cost_price', $data['costPrice']);
        $stmt->bindParam(':avg_cost_price', $data['avgCostPrice']);
        $stmt->bindParam(':image', $data['image']);
        $stmt->bindParam(':description', $data['description']);
        $imeis_json = json_encode($data['imeis'] ?? []);
        $stmt->bindParam(':imeis', $imeis_json);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Producto actualizado']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al actualizar producto']);
        }
        break;
        
    case 'DELETE':
        // Eliminar producto
        $id = $_GET['id'] ?? null;
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit();
        }
        
        $query = "DELETE FROM products WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Producto eliminado']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al eliminar producto']);
        }
        break;
}
?>
