<?php

namespace App\Service;

use App\Service\ApiClient;
use Psr\Container\ContainerInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

class SecurityService
{
    const ROLE_OWNER = 'ROLE_OWNER';
    const ROLE_MANAGER = 'ROLE_MANAGER';
    const ROLE_DISPATCHER = 'ROLE_DISPATCHER';
    const ROLE_USER = 'ROLE_USER';

    const ACTION_VIEW_JOBS = 'view_jobs';
    const ACTION_CREATE_JOB = 'create_job';
    const ACTION_UPDATE_JOB = 'update_job';
    const ACTION_DELETE_JOB = 'delete_job';

    const ACTION_VIEW_CUSTOMERS = 'view_customers';
    const ACTION_CREATE_CUSTOMER = 'create_customer';
    const ACTION_UPDATE_CUSTOMER = 'update_customer';
    const ACTION_DELETE_CUSTOMER = 'delete_customer';

    const ACTION_VIEW_OWN_JOBS = 'view_own_jobs';

    const ACTION_MANAGE_SETTINGS = 'settings';
    const ACTION_MANAGE_TEAM = 'team';
    const ACTION_MANAGE_PROFILE = 'profile';
    const ACTION_MANAGE_FINANCE = 'finance';
    const ACTION_MANAGE_SUBSCRIPTION = 'subscription';

    private static $permissions = [
        // Owner has every manager capability plus owner-only actions
        // (billing/subscription, and future ones such as API keys).
        self::ROLE_OWNER => [
            self::ACTION_VIEW_JOBS,
            self::ACTION_CREATE_JOB,
            self::ACTION_UPDATE_JOB,
            self::ACTION_DELETE_JOB,
            self::ACTION_MANAGE_SETTINGS,
            self::ACTION_MANAGE_TEAM,
            self::ACTION_MANAGE_PROFILE,
            self::ACTION_MANAGE_FINANCE,
            self::ACTION_MANAGE_SUBSCRIPTION,
            self::ACTION_VIEW_CUSTOMERS,
            self::ACTION_CREATE_CUSTOMER,
            self::ACTION_UPDATE_CUSTOMER,
            self::ACTION_DELETE_CUSTOMER,
        ],
        self::ROLE_MANAGER => [
            self::ACTION_VIEW_JOBS,
            self::ACTION_CREATE_JOB,
            self::ACTION_UPDATE_JOB,
            self::ACTION_DELETE_JOB,
            self::ACTION_MANAGE_SETTINGS,
            self::ACTION_MANAGE_TEAM,
            self::ACTION_MANAGE_PROFILE,
            self::ACTION_MANAGE_FINANCE,
            self::ACTION_MANAGE_SUBSCRIPTION,
            self::ACTION_VIEW_CUSTOMERS,
            self::ACTION_CREATE_CUSTOMER,
            self::ACTION_UPDATE_CUSTOMER,
            self::ACTION_DELETE_CUSTOMER,
        ],
        self::ROLE_DISPATCHER => [
            self::ACTION_VIEW_JOBS,
            self::ACTION_CREATE_JOB,
            self::ACTION_UPDATE_JOB,
            self::ACTION_VIEW_CUSTOMERS,
            self::ACTION_CREATE_CUSTOMER,
            self::ACTION_UPDATE_CUSTOMER,
            self::ACTION_DELETE_CUSTOMER,
            self::ACTION_MANAGE_PROFILE,
        ],
        self::ROLE_USER => [
            self::ACTION_VIEW_OWN_JOBS,
            self::ACTION_CREATE_JOB,
            self::ACTION_UPDATE_JOB,
            self::ACTION_MANAGE_PROFILE,
            self::ACTION_CREATE_CUSTOMER,
            self::ACTION_UPDATE_CUSTOMER,
            self::ACTION_MANAGE_FINANCE
        ],
    ];

    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    public function isGranted($action)
    {
        $user = $this->accountService->getCurrentUser();
        if (!$user) {
            return false;
        }

        foreach (self::$permissions as $role => $actions) {
            foreach ($user['roles'] as $userRole) {
                if ($userRole == $role && in_array($action, $actions)) {
                    return true;
                }
            }
        }

        return false;
    }

    public function hasRole($role)
    {
        $user = $this->accountService->getCurrentUser();
        if (!$user) {
            return false;
        }

        return !empty($user['roles']) && in_array($role, $user['roles']);
    }
}
