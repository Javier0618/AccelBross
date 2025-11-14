<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        $query = "SELECT * FROM purchases ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $purchases = $stmt->fetchAll();
        
        foreach ($purchases as &$purchase) {
            $purchase['items'] = json_decode($purchase['items'], true) ?? [];
        }
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $purchases]);
        break;
        
    case 'POST':
        $data = $input;
        
        $db->beginTransaction();
        
        try {
            // Crear compra
            $query = "INSERT INTO purchases (supplier_id, purchase_date, items, total, note, payment_status, due_date, created_by) 
                      VALUES (:supplier_id, :purchase_date, :items, :total, :note, :payment_status, :due_date, :created_by)";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(':supplier_id', $data['supplierId']);
            $stmt->bindParam(':purchase_date', $data['date']);
            $items_json = json_encode($data['items']);
            $stmt->bindParam(':items', $items_json);
            $stmt->bindParam(':total', $data['total']);
            $stmt->bindParam(':note', $data['note']);
            $stmt->bindParam(':payment_status', $data['paymentStatus']);
            $stmt->bindParam(':due_date', $data['dueDate']);
            $stmt->bindParam(':created_by', $_SESSION['user_email']);
            
            $stmt->execute();
            $purchase_id = $db->lastInsertId();
            
            // Actualizar stock y costos de productos
            foreach ($data['items'] as $item) {
                // Obtener producto actual
                $getProduct = "SELECT stock, avg_cost_price, imeis FROM products WHERE id = :id";
                $getStmt = $db->prepare($getProduct);
                $getStmt->bindParam(':id', $item['productId']);
                $getStmt->execute();
                $product = $getStmt->fetch();
                
                $currentStock = $product['stock'];
                $currentAvgCost = $product['avg_cost_price'];
                
                // Calcular nuevo costo promedio ponderado
                $newStock = $currentStock + $item['quantity'];
                $totalCost = ($currentAvgCost * $currentStock) + ($item['costPrice'] * $item['quantity']);
                $newAvgCost = $newStock > 0 ? $totalCost / $newStock : 0;
                
                // Actualizar producto
                $updateQuery = "UPDATE products SET stock = :stock, cost_price = :cost_price, avg_cost_price = :avg_cost_price";
                
                // Si tiene IMEIs, agregarlos
                if (isset($item['imeis']) && count($item['imeis']) > 0) {
                    $currentImeis = json_decode($product['imeis'], true) ?? [];
                    $newImeis = array_merge($currentImeis, $item['imeis']);
                    $imeis_json = json_encode($newImeis);
                    $updateQuery .= ", imeis = :imeis";
                }
                
                $updateQuery .= " WHERE id = :id";
                
                $updateStmt = $db->prepare($updateQuery);
                $updateStmt->bindParam(':stock', $newStock);
                $updateStmt->bindParam(':cost_price', $item['costPrice']);
                $updateStmt->bindParam(':avg_cost_price', $newAvgCost);
                if (isset($imeis_json)) {
                    $updateStmt->bindParam(':imeis', $imeis_json);
                }
                $updateStmt->bindParam(':id', $item['productId']);
                $updateStmt->execute();
            }
            
            // Si es compra pendiente, crear cuenta por pagar
            if ($data['paymentStatus'] === 'pending') {
                $supplierQuery = "SELECT name FROM suppliers WHERE id = :id";
                $supplierStmt = $db->prepare($supplierQuery);
                $supplierStmt->bindParam(':id', $data['supplierId']);
                $supplierStmt->execute();
                $supplier = $supplierStmt->fetch();
                
                $apQuery = "INSERT INTO accounts_payable (purchase_id, supplier_id, supplier_name, amount, due_date, status, created_by)
                           VALUES (:purchase_id, :supplier_id, :supplier_name, :amount, :due_date, 'pending', :created_by)";
                $apStmt = $db->prepare($apQuery);
                $apStmt->bindParam(':purchase_id', $purchase_id);
                $apStmt->bindParam(':supplier_id', $data['supplierId']);
                $apStmt->bindParam(':supplier_name', $supplier['name']);
                $apStmt->bindParam(':amount', $data['total']);
                $apStmt->bindParam(':due_date', $data['dueDate']);
                $apStmt->bindParam(':created_by', $_SESSION['user_email']);
                $apStmt->execute();
            }
            
            $db->commit();
            
            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $purchase_id]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
}
?>
